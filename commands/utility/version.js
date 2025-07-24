const { SlashCommandBuilder } = require('discord.js');
const { version } = require('../../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('version')
		.setDescription('Displays the Version of this Bot.'),
	async execute(interaction) {
		await interaction.reply(`Current Version: ${version}`);
	},
};