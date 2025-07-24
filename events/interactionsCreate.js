const { Events, MessageFlags } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error('[WARN] No command matching the following input was found:', interaction.commandName);
			return;
		}

		try {
			await command.execute(interaction);
		}
		catch (error) {
			await handleCommandError(interaction, error);
		}
	},
};

async function handleCommandError(interaction, error) {
	console.error('[WARN] Command execution error:', error);

	const errorMessage = {
		content: 'There was an error while executing this command!',
		flags: MessageFlags.Ephemeral,
	};

	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(errorMessage);
		}
		else {
			await interaction.reply(errorMessage);
		}
	}
	catch (followUpError) {
		console.error('[WARN] Failed to send error message:', followUpError);
	}
}