import '@dotenvx/dotenvx/config';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import io from '@pm2/io';

import GoogleCredentials from '../client_secret.json' with { type: 'json' };
import { debugLogger } from './helper/debugLogger.js';
import { notifyDiscord } from './helper/discordNotification.js';
import { calculateMopupTiming } from './helper/mopup.js';
import { getSheetRowsCached } from './helper/sheetsCache.js';
import * as usageTracker from './helper/usageTracker.js';
import type { Command } from './types/index.js';

io.init();

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
  debugLogger.boot('Validating environment variables');
  const required = ['TOKEN', 'CLIENT_ID', 'GUILD_ID', 'GOOGLE_SHEET_URL', 'GOOGLE_SHEET_ID'];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    debugLogger.error('BOOT', 'Missing required environment variables', { missing });
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
  debugLogger.boot('Environment validation passed', { checked: required.length });
}

validateEnvironment();

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

let isShuttingDown = false;

(async function initializeBot() {
  debugLogger.boot('Starting bot initialization');
  try {
    debugLogger.step('BOOT', 'Step 1: Notifying Discord of startup');
    await notifyDiscord({ type: 'startup' });
    
    debugLogger.step('BOOT', 'Step 2: Initializing Google Sheets');
    await initializeGoogleSheets();
    
    debugLogger.step('BOOT', 'Step 3: Loading commands');
    await loadCommands();
    
    debugLogger.step('BOOT', 'Step 4: Loading events');
    await loadEvents();
    
    debugLogger.step('BOOT', 'Step 5: Starting mopup timer');
    startMopupTimer();
    
    debugLogger.step('BOOT', 'Step 6: Starting WAL checkpoint');
    usageTracker.startWALCheckpoint(5 * 60 * 1000);
    
    debugLogger.step('BOOT', 'Step 7: Updating mopup channels');
    await updateMopupChannels();
    
    debugLogger.step('BOOT', 'Step 8: Logging in to Discord');
    await client.login(process.env.TOKEN);
    debugLogger.boot('Bot initialization completed successfully');
  } catch (error) {
    debugLogger.error('BOOT', 'Failed to initialize bot', { error: error as Error });
    console.error('[BOOT] Failed to initialize bot:', error);
    await notifyDiscord({ type: 'error', error: error as Error });
    process.exitCode = 1;
  }
})();

async function gracefulShutdown(): Promise<void> {
  if (isShuttingDown) {
    debugLogger.warn('SHUTDOWN', 'Shutdown already in progress, ignoring duplicate signal');
    return;
  }
  isShuttingDown = true;

  debugLogger.step('SHUTDOWN', 'Starting graceful shutdown');
  console.log('[SHUTDOWN] Shutting down gracefully...');

  try {
    try {
      debugLogger.step('SHUTDOWN', 'Stopping WAL checkpoint');
      usageTracker.stopWALCheckpoint();
      debugLogger.step('SHUTDOWN', 'Running final WAL checkpoint');
      usageTracker.checkpoint('TRUNCATE');
      debugLogger.step('SHUTDOWN', 'Closing database connection');
      usageTracker.closeDb();
    } catch (e) {
      debugLogger.error('SHUTDOWN', 'WAL checkpoint error during shutdown', { error: e });
      console.error('[SHUTDOWN] WAL checkpoint error:', e);
    }
    debugLogger.step('SHUTDOWN', 'Notifying Discord of shutdown');
    await notifyDiscord({ type: 'shutdown' });
    debugLogger.step('SHUTDOWN', 'Destroying Discord client');
    client.destroy();
    debugLogger.step('SHUTDOWN', 'Bot shut down successfully');
    console.log('[SHUTDOWN] Bot shut down successfully');
    process.exitCode = 0;
  } catch (error) {
    debugLogger.error('SHUTDOWN', 'Error during shutdown', { error: error as Error });
    console.error('[SHUTDOWN] Error during shutdown:', error);
    process.exitCode = 1;
  }
}

async function initializeGoogleSheets(): Promise<void> {
  debugLogger.step('GOOGLE_SHEETS', 'Initializing Google Sheets connection');
  const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];

  debugLogger.debug('GOOGLE_SHEETS', 'Creating JWT service account authentication', {
    email: GoogleCredentials.client_email,
    scopes: SCOPES,
  });
  const serviceAccountAuth = new JWT({
    email: GoogleCredentials.client_email,
    key: GoogleCredentials.private_key,
    scopes: SCOPES,
  });

  debugLogger.debug('GOOGLE_SHEETS', 'Creating GoogleSpreadsheet instance', {
    url: process.env.GOOGLE_SHEET_URL,
  });
  (client as any).GoogleSheet = new GoogleSpreadsheet(
    process.env.GOOGLE_SHEET_URL!,
    serviceAccountAuth,
  );

  debugLogger.step('GOOGLE_SHEETS', 'Loading sheet info');
  await (client as any).GoogleSheet.loadInfo();
  debugLogger.step('GOOGLE_SHEETS', 'Prefetching sheet rows to warm cache', {
    sheetId: process.env.GOOGLE_SHEET_ID,
  });
  await getSheetRowsCached((client as any).GoogleSheet, process.env.GOOGLE_SHEET_ID!);
  console.log('[BOOT] Prefetched Google Sheet rows to warm cache.');
  console.log('[BOOT] Loaded Google Sheet:', (client as any).GoogleSheet.title);
  debugLogger.info('GOOGLE_SHEETS', 'Google Sheets initialized successfully', {
    title: (client as any).GoogleSheet.title,
    sheetId: (client as any).GoogleSheet.spreadsheetId,
  });
}

async function loadCommands(): Promise<void> {
  debugLogger.step('COMMANDS', 'Loading commands from filesystem');
  const commandsPath = path.join(__dirname, 'commands');
  debugLogger.debug('COMMANDS', 'Commands directory', { path: commandsPath });
  const entries = fs.readdirSync(commandsPath);

  for (const entry of entries) {
    const entryPath = path.join(commandsPath, entry);
    const stat = fs.lstatSync(entryPath);

    if (stat.isDirectory()) {
      debugLogger.debug('COMMANDS', 'Processing command directory', { directory: entry });
      const files = fs.readdirSync(entryPath).filter((f) => f.endsWith('.js'));
      debugLogger.debug('COMMANDS', 'Found command files in directory', {
        directory: entry,
        files: files.length,
      });
      for (const file of files) {
        const filePath = path.join(entryPath, file);
        await registerCommand(filePath, file);
      }
    } else if (entry.endsWith('.js')) {
      debugLogger.debug('COMMANDS', 'Processing command file', { file: entry });
      await registerCommand(entryPath, entry);
    }
  }
  debugLogger.info('COMMANDS', 'Commands loading completed', {
    totalCommands: (client as any).commands.size,
  });
}

async function registerCommand(filePath: string, fileName: string): Promise<void> {
  debugLogger.debug('COMMANDS', 'Registering command', { file: fileName, path: filePath });
  try {
    const mod = await import(pathToFileURL(filePath).href);
    const command = mod.default ?? mod;
    if (command?.data && command?.execute) {
      (client as any).commands.set(command.data.name, command as Command);
      debugLogger.step('COMMANDS', 'Command registered successfully', {
        name: command.data.name,
        description: command.data.description,
        file: fileName,
      });
    } else {
      debugLogger.warn('COMMANDS', 'Invalid command file structure', {
        file: fileName,
        hasData: !!command?.data,
        hasExecute: !!command?.execute,
      });
      console.warn(`[BOOT] Invalid command file: ${fileName}`);
    }
  } catch (err) {
    debugLogger.error('COMMANDS', 'Failed to load command', {
      file: fileName,
      error: err as Error,
    });
    console.error(`[BOOT] Failed to load command: ${fileName}`, err);
  }
}

async function loadEvents(): Promise<void> {
  debugLogger.step('EVENTS', 'Loading events from filesystem');
  const eventsPath = path.join(__dirname, 'events');
  debugLogger.debug('EVENTS', 'Events directory', { path: eventsPath });
  const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
  debugLogger.debug('EVENTS', 'Found event files', { count: eventFiles.length });
  
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    debugLogger.debug('EVENTS', 'Loading event file', { file });
    try {
      const mod = await import(pathToFileURL(filePath).href);
      const event = mod.default ?? mod;
      if (event.once) {
        (client as any).once(event.name, (...args: unknown[]) => {
          debugLogger.event(event.name, 'Event triggered (once)', { file });
          event.execute(...args);
        });
        debugLogger.step('EVENTS', 'Registered once event', { name: event.name, file });
      } else {
        (client as any).on(event.name, (...args: unknown[]) => {
          debugLogger.event(event.name, 'Event triggered', { file });
          event.execute(...args);
        });
        debugLogger.step('EVENTS', 'Registered event listener', { name: event.name, file });
      }
    } catch (err) {
      debugLogger.error('EVENTS', 'Failed to load event', { file, error: err as Error });
    }
  }
  debugLogger.info('EVENTS', 'Events loading completed', { totalEvents: eventFiles.length });
}

function startMopupTimer(): void {
  if (!process.env.CHANNEL_ID1 || !process.env.CHANNEL_ID2) {
    debugLogger.warn('MOPUP', 'Mopup timer disabled: Channel IDs missing', {
      hasChannel1: !!process.env.CHANNEL_ID1,
      hasChannel2: !!process.env.CHANNEL_ID2,
    });
    console.warn('[BOOT] Mopup timer disabled: Channel IDs missing');
    return;
  }
  debugLogger.step('MOPUP', 'Starting mopup timer', {
    interval: '5 minutes',
    channel1: process.env.CHANNEL_ID1,
    channel2: process.env.CHANNEL_ID2,
  });
  setInterval(() => {
    debugLogger.step('MOPUP', 'Mopup timer triggered (5min interval)');
    updateMopupChannels();
  }, 5 * 60 * 1000);
}

async function updateMopupChannels(): Promise<void> {
  debugLogger.step('MOPUP', 'Updating mopup channels');
  try {
    debugLogger.debug('MOPUP', 'Calculating mopup timing');
    const mopupInfo = calculateMopupTiming();
    debugLogger.debug('MOPUP', 'Mopup timing calculated', {
      status: mopupInfo.status,
      time: mopupInfo.time,
    });
    
    const channel1 = client.channels.cache.get(process.env.CHANNEL_ID1!);
    const channel2 = client.channels.cache.get(process.env.CHANNEL_ID2!);
    debugLogger.debug('MOPUP', 'Retrieved channels from cache', {
      channel1Found: !!channel1,
      channel2Found: !!channel2,
    });

    if (channel1 && 'setName' in channel1) {
      const statusEmoji = mopupInfo.status === 'ACTIVE' ? '🟢' : '🔴';
      const newName = `${statusEmoji} ${mopupInfo.status} Mopup`;
      debugLogger.debug('MOPUP', 'Updating channel 1 name', { newName });
      await (channel1 as any).setName(newName);
      debugLogger.step('MOPUP', 'Channel 1 name updated successfully');
    }
    if (channel2 && 'setName' in channel2) {
      const newName = `Time remaining: ${mopupInfo.time}`;
      debugLogger.debug('MOPUP', 'Updating channel 2 name', { newName });
      await (channel2 as any).setName(newName);
      debugLogger.step('MOPUP', 'Channel 2 name updated successfully');
    }
    debugLogger.info('MOPUP', 'Mopup channels updated successfully');
  } catch (error) {
    debugLogger.error('MOPUP', 'Failed to update mopup channels', { error: error as Error });
    console.error('[EVENT:MOPUP] Failed to update mopup channels:', error);
  }
}
