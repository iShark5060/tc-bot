const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('version')
		.setDescription('Displays the Version of this Bot.'),

	async execute(interaction) {
		await interaction.reply(`Current Version: ${config.version}`);
	},
};