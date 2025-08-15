const { Events } = require('discord.js');
const { handleCommandError } = require('../helper/errorHandler.js');

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
		} catch (error) {
			await handleCommandError(interaction, error);
		}
	},
};