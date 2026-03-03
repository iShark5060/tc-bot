/**
 * Discord Slash Command Deployment Script
 * Clears existing commands and deploys new ones from the commands directory.
 * Run with: npx tsx src/deployCommands.ts
 * @module deployCommands
 */
import '@dotenvx/dotenvx/config';
import { REST, Routes } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Command } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('[DEPLOY] Missing TOKEN in environment variables.');
  throw new Error('Missing TOKEN in environment variables');
}

const rest = new REST({ version: '10' }).setToken(TOKEN!);

/**
 * Main deployment entry point.
 * Loads commands, clears existing, and deploys new ones.
 */
(async function deployCommands(): Promise<void> {
  try {
    const commands = await loadCommands();
    await deployNewCommands(commands);
  } catch (error) {
    console.error('[DEPLOY] Failed to deploy commands:', error);
    process.exitCode = 1;
  }
})();

/**
 * Loads all command definitions from the commands directory.
 * Recursively scans subdirectories for .ts command files.
 * @returns Array of command JSON data for Discord API
 */
async function loadCommands(): Promise<unknown[]> {
  const commands: unknown[] = [];
  const root = path.join(__dirname, 'commands');

  const stack: string[] = [root];
  while (stack.length) {
    const current = stack.pop()!;
    const stat = await fs.lstat(current);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(current);
      for (const entry of entries) {
        stack.push(path.join(current, entry));
      }
      continue;
    }

    if (current.endsWith('.ts')) {
      try {
        const mod = await import(pathToFileURL(current).href);
        const command = mod.default ?? mod;
        if (command?.data && command?.execute) {
          commands.push((command as Command).data.toJSON());
        } else {
          console.warn(`[DEPLOY] Skipping invalid command: ${current}`);
        }
      } catch (err) {
        console.error(`[DEPLOY] Failed to load command: ${current}`, err);
      }
    }
  }

  console.log(`[DEPLOY] Loaded ${commands.length} commands.`);
  return commands;
}

/**
 * Deploys command definitions to Discord as global application commands.
 * Includes a 3-second delay for cancellation opportunity.
 * @param commands - Array of command JSON data to deploy
 */
async function deployNewCommands(commands: unknown[]): Promise<void> {
  console.log(`[DEPLOY] About to deploy ${commands.length} commands.`);
  console.log(
    `[DEPLOY] Commands: ${commands.map((c) => (c as { name: string }).name).join(', ')}`,
  );

  console.log('[DEPLOY] Starting in 3 seconds... (Ctrl+C to cancel)');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const clientId = process.env.CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing CLIENT_ID in environment variables');
  }

  const guildId = process.env.GUILD_ID;
  if (guildId) {
    const guildData = (await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    })) as unknown[];
    console.log(`[DEPLOY] Successfully deployed ${guildData.length} guild commands.`);
  }

  const globalData = (await rest.put(Routes.applicationCommands(clientId), {
    body: commands,
  })) as unknown[];
  console.log(`[DEPLOY] Successfully deployed ${globalData.length} global commands.`);
}