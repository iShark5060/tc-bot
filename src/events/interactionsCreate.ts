import { Events, MessageFlags, type Interaction, type StringSelectMenuInteraction } from 'discord.js';

import { debugLogger } from '../helper/debugLogger.js';
import { handleCommandError } from '../helper/errorHandler.js';
import { commandErrors, commandsCounter, commandsPerSecond } from '../helper/metrics.js';
import { logCommandUsage } from '../helper/usageTracker.js';
import type { Event, ExtendedClient } from '../types/index.js';

const interactionsCreate: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    debugLogger.event(Events.InteractionCreate, 'Interaction received', {
      type: interaction.type,
      id: interaction.id,
      userId: interaction.user?.id,
      guildId: interaction.guildId,
    });

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith('healtroop:')
    ) {
      debugLogger.step('INTERACTION', 'Processing healtroop select menu', {
        customId: interaction.customId,
      });
      try {
        const mod = await import('../commands/aow/healtroop.js');
        const healtroop = mod.default ?? mod;
        if ('handleSelect' in healtroop && typeof healtroop.handleSelect === 'function') {
          debugLogger.debug('INTERACTION', 'Calling healtroop.handleSelect');
          await healtroop.handleSelect(interaction as StringSelectMenuInteraction);
          debugLogger.step('INTERACTION', 'Healtroop select menu handled successfully');
        } else {
          debugLogger.warn('INTERACTION', 'Healtroop handleSelect not available');
          await interaction.reply({
            content: 'Selector not available.',
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        debugLogger.error('INTERACTION', 'Error handling healtroop select menu', {
          error: error as Error,
          customId: interaction.customId,
        });
        await handleCommandError(interaction, error);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) {
      debugLogger.debug('INTERACTION', 'Interaction is not a chat input command, skipping', {
        type: interaction.type,
      });
      return;
    }

    const commandName = interaction.commandName;
    debugLogger.command(commandName, 'Command execution started', {
      userId: interaction.user?.id,
      username: interaction.user?.username,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      options: interaction.options.data.map(opt => ({
        name: opt.name,
        value: opt.value,
      })),
    });

    const command = (interaction.client as ExtendedClient).commands.get(commandName);
    if (!command) {
      debugLogger.warn('INTERACTION', 'Command not found in registry', { commandName });
      console.warn(`[EVENT:INTERACTION] Command not found: ${commandName}`);
      return;
    }

    const startTime = Date.now();
    try {
      debugLogger.step('COMMAND', 'Executing command', { commandName });
      await command.execute(interaction);
      const duration = Date.now() - startTime;
      debugLogger.command(commandName, 'Command executed successfully', {
        duration: `${duration}ms`,
      });

      commandsCounter.inc();
      commandsPerSecond.mark();

      debugLogger.debug('COMMAND', 'Logging command usage', { commandName });
      logCommandUsage({
        commandName,
        userId: interaction.user?.id,
        guildId: interaction.guildId ?? undefined,
        success: true,
      });
      debugLogger.step('COMMAND', 'Command usage logged', { commandName });
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLogger.error('COMMAND', 'Command execution failed', {
        commandName,
        duration: `${duration}ms`,
        error: error as Error,
      });

      commandErrors.inc();
      await handleCommandError(interaction, error);
      try {
        debugLogger.debug('COMMAND', 'Logging failed command usage', { commandName });
        logCommandUsage({
          commandName,
          userId: interaction.user?.id,
          guildId: interaction.guildId ?? undefined,
          success: false,
          errorMessage: (error as Error)?.message || String(error),
        });
      } catch (logError) {
        debugLogger.error('COMMAND', 'Failed to log command usage', {
          commandName,
          error: logError as Error,
        });
        // ignore logging errors
      }
    }
  },
};

export default interactionsCreate;