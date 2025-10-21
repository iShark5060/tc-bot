import '@dotenvx/dotenvx/config';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import GoogleCredentials from './client_secret.json' with { type: 'json' };
import { calculateMopupTiming } from './helper/mopup.js';
import { getSheetRowsCached } from './helper/sheetsCache.js';
import * as usageTracker from './helper/usageTracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fetch = global.fetch;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
  ],
});

client.cooldowns = new Collection();
client.commands = new Collection();

function validateEnvironment() {
  const required = [
    'TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'GOOGLE_SHEET_URL',
    'GOOGLE_SHEET_ID',
  ];

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
    await sendStartupNotification();
    await initializeGoogleSheets();
    await loadCommands();
    await loadEvents();
    startMopupTimer();
    usageTracker.startWALCheckpoint(5 * 60 * 1000);
    await updateMopupChannels();
    await client.login(process.env.TOKEN);
  } catch (error) {
    console.error('[BOOT] Failed to initialize bot:', error);
    await sendErrorNotification(error);
    process.exit(1);
  }
})();

async function gracefulShutdown() {
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
    await sendShutdownNotification();
    client.destroy();
    console.log('[SHUTDOWN] Bot shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('[SHUTDOWN] Error during shutdown:', error);
    process.exit(1);
  }
}

async function sendStartupNotification() {
  try {
    if (!process.env.WEBHOOK_ID || !process.env.WEBHOOK_TOKEN) return;

    const response = await fetch(
      `https://discord.com/api/webhooks/${process.env.WEBHOOK_ID}/${process.env.WEBHOOK_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'TC-Bot just started.' }),
      },
    );
    if (!response.ok) {
      console.warn(`[BOOT] Webhook returned ${response.status}`);
    }
  } catch (error) {
    console.error('[BOOT] Failed to send startup notification:', error);
  }
}

async function sendShutdownNotification() {
  try {
    if (!process.env.WEBHOOK_ID || !process.env.WEBHOOK_TOKEN) return;

    const response = await fetch(
      `https://discord.com/api/webhooks/${process.env.WEBHOOK_ID}/${process.env.WEBHOOK_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'TC-Bot is shutting down.' }),
      },
    );
    console.log('[SHUTDOWN] Notification sent:', response.status);
  } catch (error) {
    console.error('[SHUTDOWN] Failed to send shutdown notification:', error);
  }
}

async function sendErrorNotification(error) {
  try {
    if (!process.env.WEBHOOK_ID || !process.env.WEBHOOK_TOKEN) return;

    await fetch(
      `https://discord.com/api/webhooks/${process.env.WEBHOOK_ID}/${process.env.WEBHOOK_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `TC-Bot failed to start.\n${String(error?.message || error)}`,
        }),
      },
    );
  } catch {
  }
}

async function initializeGoogleSheets() {
  const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];

  const serviceAccountAuth = new JWT({
    email: GoogleCredentials.client_email,
    key: GoogleCredentials.private_key,
    scopes: SCOPES,
  });

  client.GoogleSheet = new GoogleSpreadsheet(
    process.env.GOOGLE_SHEET_URL,
    serviceAccountAuth,
  );

  await client.GoogleSheet.loadInfo();
  await getSheetRowsCached(client.GoogleSheet, process.env.GOOGLE_SHEET_ID);
  console.log('[BOOT] Prefetched Google Sheet rows to warm cache.');
  console.log('[BOOT] Loaded Google Sheet:', client.GoogleSheet.title);
}

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const entries = fs.readdirSync(commandsPath);

  for (const entry of entries) {
    const entryPath = path.join(commandsPath, entry);
    const stat = fs.lstatSync(entryPath);

    if (stat.isDirectory()) {
      const files = fs.readdirSync(entryPath).filter((f) => f.endsWith('.js'));
      for (const file of files) {
        const filePath = path.join(entryPath, file);
        await registerCommand(filePath, file);
      }
    } else if (entry.endsWith('.js')) {
      await registerCommand(entryPath, entry);
    }
  }
}

async function registerCommand(filePath, fileName) {
  try {
    const mod = await import(pathToFileURL(filePath).href);
    const command = mod.default ?? mod;
    if (command?.data && command?.execute) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[BOOT] Invalid command file: ${fileName}`);
    }
  } catch (err) {
    console.error(`[BOOT] Failed to load command: ${fileName}`, err);
  }
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  for (const file of fs
    .readdirSync(eventsPath)
    .filter((f) => f.endsWith('.js'))) {
    const mod = await import(pathToFileURL(path.join(eventsPath, file)).href);
    const event = mod.default ?? mod;
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

function startMopupTimer() {
  if (!process.env.CHANNEL_ID1 || !process.env.CHANNEL_ID2) {
    console.warn('[BOOT] Mopup timer disabled: Channel IDs missing');
    return;
  }
  setInterval(updateMopupChannels, 5 * 60 * 1000);
}

async function updateMopupChannels() {
  try {
    const mopupInfo = calculateMopupTiming();
    const channel1 = client.channels.cache.get(process.env.CHANNEL_ID1);
    const channel2 = client.channels.cache.get(process.env.CHANNEL_ID2);

    if (channel1) await channel1.setName(`${mopupInfo.status} Mopup`);
    if (channel2) await channel2.setName(`Time remaining: ${mopupInfo.time}`);
  } catch (error) {
    console.error('[WARN] Failed to update mopup channels:', error);
  }
}