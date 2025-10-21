import { Events, MessageFlags } from 'discord.js';
import { handleCommandError } from '../helper/errorHandler.js';
import { logCommandUsage } from '../helper/usageTracker.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (
      interaction.isStringSelectMenu?.() &&
      typeof interaction.customId === 'string' &&
      interaction.customId.startsWith('healtroop:')
    ) {
      try {
        const mod = await import('../commands/aow/healtroop.js');
        const healtroop = mod.default ?? mod;
        if (typeof healtroop.handleSelect === 'function') {
          await healtroop.handleSelect(interaction);
        } else {
          await interaction.reply({
            content: 'Selector not available.',
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        await handleCommandError(interaction, error);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[WARN] Command not found: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
      await logCommandUsage({
        commandName: interaction.commandName,
        userId: interaction.user?.id,
        guildId: interaction.guildId || null,
        success: true,
      });
    } catch (error) {
      await handleCommandError(interaction, error);
      try {
        await logCommandUsage({
          commandName: interaction.commandName,
          userId: interaction.user?.id,
          guildId: interaction.guildId || null,
          success: false,
          errorMessage: error?.message || String(error),
        });
      } catch {
      }
    }
  },
};