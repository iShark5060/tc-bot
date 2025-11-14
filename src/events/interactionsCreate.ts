import {
  Events,
  type Interaction,
  type StringSelectMenuInteraction,
} from 'discord.js';

import { handleCommandError } from '../helper/errorHandler.js';
import {
  commandErrors,
  commandsCounter,
  commandsPerSecond,
} from '../helper/metrics.js';
import { logCommandUsage } from '../helper/usageTracker.js';
import type { Event } from '../types/index.js';

const interactionsCreate: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (
      (interaction as StringSelectMenuInteraction).isStringSelectMenu?.() &&
      typeof (interaction as any).customId === 'string' &&
      (interaction as any).customId.startsWith('healtroop:')
    ) {
      try {
        const mod = await import('../commands/aow/healtroop.js');
        const healtroop = mod.default ?? mod;
        if ('handleSelect' in healtroop && typeof healtroop.handleSelect === 'function') {
          await (healtroop as any).handleSelect(interaction as StringSelectMenuInteraction);
        } else {
          await (interaction as any).reply({
            content: 'Selector not available.',
            ephemeral: true
          });
        }
      } catch (error) {
        await handleCommandError(interaction as any, error);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = (interaction.client as any).commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[EVENT:INTERACTION] Command not found: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
      commandsCounter.inc();
      commandsPerSecond.mark();
      await logCommandUsage({
        commandName: interaction.commandName,
        userId: interaction.user?.id,
        guildId: interaction.guildId || null,
        success: true,
      });
    } catch (error) {
      commandErrors.inc();
      await handleCommandError(interaction as any, error);
      try {
        await logCommandUsage({
          commandName: interaction.commandName,
          userId: interaction.user?.id,
          guildId: interaction.guildId || null,
          success: false,
          errorMessage: (error as Error)?.message || String(error),
        });
      } catch {
        // ignore logging errors
      }
    }
  },
};

export default interactionsCreate;
