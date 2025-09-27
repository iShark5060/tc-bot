const { Events } = require('discord.js');
const { handleCommandError } = require('../helper/errorHandler.js');
const { logCommandUsage } = require('../helper/usageTracker.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
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