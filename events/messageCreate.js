const { Events, MessageFlags } = require('discord.js');

module.exports = {
	name: Events.MessageCreate,
	async execute(interaction) {
		if (interaction.channel.name == 'tc-autobot') {
			if (interaction.content == '!tcmu' && !interaction.member.user.bot) {
				try {
					const command = interaction.client.commands.get('mopup');
					await command.execute(interaction);
				}
				catch (error) {
					console.error(error);
					if (interaction.replied || interaction.deferred) {
						await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
					}
					else {
						await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
					}
				}
			}
		}
	},
};