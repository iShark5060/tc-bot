import '@dotenvx/dotenvx/config';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import GoogleCredentials from '../client_secret.json' with { type: 'json' };
import { notifyDiscord } from './helper/discordNotification.js';
import { calculateMopupTiming } from './helper/mopup.js';
import { getSheetRowsCached } from './helper/sheetsCache.js';
import * as usageTracker from './helper/usageTracker.js';
import type { Command } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
  ],
});

// Add custom properties
(client as any).commands = new Collection<string, Command>();
(client as any).GoogleSheet = null;

function validateEnvironment(): void {
  const required = ['TOKEN', 'CLIENT_ID', 'GUILD_ID', 'GOOGLE_SHEET_URL', 'GOOGLE_SHEET_ID'];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
}

validateEnvironment();

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

let isShuttingDown = false;

(async function initializeBot() {
  try {
    await notifyDiscord({ type: 'startup' });
    await initializeGoogleSheets();
    await loadCommands();
    await loadEvents();
    startMopupTimer();
    usageTracker.startWALCheckpoint(5 * 60 * 1000);
    await updateMopupChannels();
    await client.login(process.env.TOKEN);
  } catch (error) {
    console.error('[BOOT] Failed to initialize bot:', error);
    await notifyDiscord({ type: 'error', error: error as Error });
    process.exitCode = 1;
  }
})();

async function gracefulShutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[SHUTDOWN] Shutting down gracefully...');

  try {
    try {
      usageTracker.stopWALCheckpoint();
      usageTracker.checkpoint('TRUNCATE');
      usageTracker.closeDb();
    } catch (e) {
      console.error('[SHUTDOWN] WAL checkpoint error:', e);
    }
    await notifyDiscord({ type: 'shutdown' });
    client.destroy();
    console.log('[SHUTDOWN] Bot shut down successfully');
    process.exitCode = 0;
  } catch (error) {
    console.error('[SHUTDOWN] Error during shutdown:', error);
    process.exitCode = 1;
  }
}

async function initializeGoogleSheets(): Promise<void> {
  const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];

  const serviceAccountAuth = new JWT({
    email: GoogleCredentials.client_email,
    key: GoogleCredentials.private_key,
    scopes: SCOPES,
  });

  (client as any).GoogleSheet = new GoogleSpreadsheet(
    process.env.GOOGLE_SHEET_URL!,
    serviceAccountAuth,
  );

  await (client as any).GoogleSheet.loadInfo();
  await getSheetRowsCached((client as any).GoogleSheet, process.env.GOOGLE_SHEET_ID!);
  console.log('[BOOT] Prefetched Google Sheet rows to warm cache.');
  console.log('[BOOT] Loaded Google Sheet:', (client as any).GoogleSheet.title);
}

async function loadCommands(): Promise<void> {
  const commandsPath = path.join(__dirname, 'commands');
  const entries = fs.readdirSync(commandsPath);

  for (const entry of entries) {
    const entryPath = path.join(commandsPath, entry);
    const stat = fs.lstatSync(entryPath);

    if (stat.isDirectory()) {
      const files = fs.readdirSync(entryPath).filter((f) => f.endsWith('.ts'));
      for (const file of files) {
        const filePath = path.join(entryPath, file);
        await registerCommand(filePath, file);
      }
    } else if (entry.endsWith('.ts')) {
      await registerCommand(entryPath, entry);
    }
  }
}

async function registerCommand(filePath: string, fileName: string): Promise<void> {
  try {
    const mod = await import(pathToFileURL(filePath).href);
    const command = mod.default ?? mod;
    if (command?.data && command?.execute) {
      (client as any).commands.set(command.data.name, command as Command);
    } else {
      console.warn(`[BOOT] Invalid command file: ${fileName}`);
    }
  } catch (err) {
    console.error(`[BOOT] Failed to load command: ${fileName}`, err);
  }
}

async function loadEvents(): Promise<void> {
  const eventsPath = path.join(__dirname, 'events');
  for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.ts'))) {
    const mod = await import(pathToFileURL(path.join(eventsPath, file)).href);
    const event = mod.default ?? mod;
    if (event.once) {
      (client as any).once(event.name, (...args: unknown[]) => event.execute(...args));
    } else {
      (client as any).on(event.name, (...args: unknown[]) => event.execute(...args));
    }
  }
}

function startMopupTimer(): void {
  if (!process.env.CHANNEL_ID1 || !process.env.CHANNEL_ID2) {
    console.warn('[BOOT] Mopup timer disabled: Channel IDs missing');
    return;
  }
  setInterval(updateMopupChannels, 5 * 60 * 1000);
}

async function updateMopupChannels(): Promise<void> {
  try {
    const mopupInfo = calculateMopupTiming();
    const channel1 = client.channels.cache.get(process.env.CHANNEL_ID1!);
    const channel2 = client.channels.cache.get(process.env.CHANNEL_ID2!);

    if (channel1 && 'setName' in channel1) {
      await (channel1 as any).setName(`${mopupInfo.status} Mopup`);
    }
    if (channel2 && 'setName' in channel2) {
      await (channel2 as any).setName(`Time remaining: ${mopupInfo.time}`);
    }
  } catch (error) {
    console.error('[WARN] Failed to update mopup channels:', error);
  }
}
