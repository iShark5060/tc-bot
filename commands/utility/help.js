const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('List all available commands with usage examples'),
	examples: ['/help'],

	async execute(interaction) {
		const commands = interaction.client.commands;

		if (!commands || commands.size === 0) {
			return interaction.reply({
				content: 'No commands are currently available.',
				ephemeral: true,
			});
		}

		const commandList = commands
			.map((cmd) => {
				let entry = `**/${cmd.data.name}** — ${cmd.data.description}`;
				if (cmd.examples && cmd.examples.length > 0) {
					entry += `\n   _Example:_ ${cmd.examples.join(' | ')}`;
				}
				return entry;
			})
			.join('\n\n');

		const embed = new EmbedBuilder()
			.setColor(0x00ae86)
			.setTitle('📜 Available Commands')
			.setDescription(commandList)
			.setFooter({
				text: `Requested by ${interaction.user.username}`,
				iconURL: interaction.user.displayAvatarURL(),
			})
			.setTimestamp();

		await interaction.reply({ embeds: [embed], ephemeral: true });
	},
};