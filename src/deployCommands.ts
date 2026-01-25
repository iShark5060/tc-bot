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
  process.exitCode = 1;
}

const rest = new REST({ version: '10' }).setToken(TOKEN!);

/**
 * Main deployment entry point.
 * Loads commands, clears existing, and deploys new ones.
 */
(async function deployCommands(): Promise<void> {
  try {
    const commands = await loadCommands();
    await clearExistingCommands();
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
 * Clears all existing slash commands from Discord.
 * Removes both guild-specific and global commands.
 */
async function clearExistingCommands(): Promise<void> {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID!,
        process.env.GUILD_ID!,
      ),
      { body: [] },
    );
    console.log('[DEPLOY] Deleted all guild commands.');

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
      body: [],
    });
    console.log('[DEPLOY] Deleted all global commands.');
  } catch (error) {
    console.error('[DEPLOY] Failed to clear existing commands:', error);
    throw error;
  }
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

  const data = (await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
    body: commands,
  })) as unknown[];
  console.log(`[DEPLOY] Successfully deployed ${data.length} commands.`);
}