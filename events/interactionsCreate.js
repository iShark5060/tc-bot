const { Events } = require('discord.js');
const { handleCommandError } = require('../helper/errorHandler.js');
const { logCommandUsage } = require('../helper/usageTracker.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
  // Handle healtroop selection menu
  if (interaction.isStringSelectMenu?.() &&
      typeof interaction.customId === 'string' &&
      interaction.customId.startsWith('healtroop:')) {
    try {
      const healtroop = require('../commands/aow/healtroop.js');
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
      } catch (e) {
      }
    }
  },
};