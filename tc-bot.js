require('@dotenvx/dotenvx').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const GoogleCredentials = require('./client_secret.json');
const { calculateMopupTiming } = require('./helper/mopup.js');
const { getSheetRowsCached } = require('./helper/sheetsCache.js');
const usageTracker = require('./helper/usageTracker.js');

const fetch =
  typeof global.fetch === 'function'
    ? global.fetch.bind(global)
    : (...args) =>
      import('node-fetch').then(({ default: f }) => f(...args));

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
      `Missing required environment variables: ${missing.join(', ')}`
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
    loadCommands();
    loadEvents();
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
      }
    );
    console.log('[BOOT] Notification sent:', response.status);
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
      }
    );
    console.log('[SHUTDOWN] Notification sent:', response.status);
  } catch (error) {
    console.error('[SHUTDOWN] Failed to send shutdown notification:', error);
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
    serviceAccountAuth
  );

  await client.GoogleSheet.loadInfo();
  await getSheetRowsCached(client.GoogleSheet, process.env.GOOGLE_SHEET_ID);
  console.log('[BOOT] Prefetched Google Sheet rows to warm cache.');
  console.log('[BOOT] Loaded Google Sheet:', client.GoogleSheet.title);
}

function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const entries = fs.readdirSync(commandsPath);

  for (const entry of entries) {
    const entryPath = path.join(commandsPath, entry);
    const stat = fs.lstatSync(entryPath);

    if (stat.isDirectory()) {
    const files = fs
      .readdirSync(entryPath)
      .filter((f) => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(entryPath, file);
      registerCommand(filePath, file);
    }
    } else if (entry.endsWith('.js')) {
    registerCommand(entryPath, entry);
    }
  }
}

function registerCommand(filePath, fileName) {
  try {
    const command = require(filePath);
    if (command?.data && command?.execute) {
    client.commands.set(command.data.name, command);
    } else {
    console.warn(`[BOOT] Invalid command file: ${fileName}`);
    }
  } catch (err) {
    console.error(`[BOOT] Failed to load command: ${fileName}`, err);
  }
}

function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  for (const file of fs
    .readdirSync(eventsPath)
    .filter((f) => f.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
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
    if (channel2)
    await channel2.setName(`Time remaining: ${mopupInfo.time}`);
  } catch (error) {
    console.error('[WARN] Failed to update mopup channels:', error);
  }
}