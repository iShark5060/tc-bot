async function handleCommandError(interaction, error) {
	console.error('[ERROR] Command execution failed:', error);

	const errorMessage = {
		content: 'There was an error while executing this command!',
		ephemeral: true,
	};

	try {
		if (interaction.replied || interaction.deferred) {
		await interaction.followUp(errorMessage);
		} else {
		await interaction.reply(errorMessage);
		}
	} catch (followUpError) {
		console.error('[ERROR] Failed to send error message:', followUpError);
	}
	}

	async function handleMessageError(message, error) {
	console.error('[ERROR] Message command execution failed:', error);

	try {
		await message.reply('There was an error while executing this command!');
	} catch (replyError) {
		console.error('[ERROR] Failed to send error message:', replyError);
	}
}

module.exports = { handleCommandError, handleMessageError };