import './env/loadEnv.js';

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { REST, Routes } from 'discord.js';

import { discoverCommandFiles } from './helper/commandDiscovery.js';
import type { Command } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('[DEPLOY] Missing TOKEN in environment variables.');
  throw new Error('Missing TOKEN in environment variables');
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async function deployCommands(): Promise<void> {
  try {
    const commands = await loadCommands();
    await deployNewCommands(commands);
  } catch (error) {
    console.error('[DEPLOY] Failed to deploy commands:', error);
    process.exitCode = 1;
  }
})();

async function loadCommands(): Promise<unknown[]> {
  const commands: unknown[] = [];
  const root = path.join(__dirname, 'commands');
  const files = await discoverCommandFiles(root, '.ts');
  for (const filePath of files) {
    try {
      const mod = await import(pathToFileURL(filePath).href);
      const command = mod.default ?? mod;
      if (command?.data && command?.execute) {
        commands.push((command as Command).data.toJSON());
      } else {
        console.warn(`[DEPLOY] Skipping invalid command: ${filePath}`);
      }
    } catch (err) {
      console.error(`[DEPLOY] Failed to load command: ${filePath}`, err);
    }
  }

  console.log(`[DEPLOY] Loaded ${commands.length} commands.`);
  return commands;
}

async function deployNewCommands(commands: unknown[]): Promise<void> {
  console.log(`[DEPLOY] About to deploy ${commands.length} commands.`);
  console.log(`[DEPLOY] Commands: ${commands.map((c) => (c as { name: string }).name).join(', ')}`);

  const clientId = process.env.CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing CLIENT_ID in environment variables');
  }

  const guildId = process.env.GUILD_ID;
  if (guildId) {
    console.log(`[DEPLOY] Target: guild deployment (${guildId}).`);
  } else {
    console.log('[DEPLOY] Target: global deployment.');
  }

  console.log('[DEPLOY] Starting in 3 seconds... (Ctrl+C to cancel)');
  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (guildId) {
    const guildData = (await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    })) as unknown[];
    console.log(`[DEPLOY] Successfully deployed ${guildData.length} guild commands.`);
    return;
  }

  const globalData = (await rest.put(Routes.applicationCommands(clientId), {
    body: commands,
  })) as unknown[];
  console.log(`[DEPLOY] Successfully deployed ${globalData.length} global commands.`);
}
