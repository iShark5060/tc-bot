const { Events, MessageFlags } = require('discord.js');

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		if (!shouldProcessMessage(message)) return;

		if (message.content === '!tcmu') {
			await handleMopupCommand(message);
		}
	},
};

function shouldProcessMessage(message) {
	return (
		message.channel.name === 'tc-autobot' &&
	!message.member?.user?.bot
	);
}

async function handleMopupCommand(message) {
	try {
		const command = message.client.commands.get('mopup');

		if (!command) {
			console.error('[WARN] Mopup command not found');
			return;
		}

		const mockInteraction = createMockInteraction(message);
		await command.execute(mockInteraction);
	}
	catch (error) {
		await handleCommandError(message, error);
	}
}

function createMockInteraction(message) {
	return {
		reply: async (options) => {
			if (options.embeds) {
				await message.channel.send({ embeds: options.embeds });
			}
			else {
				await message.channel.send(options.content || options);
			}
		},
		editReply: async (options) => {
			return this.reply(options);
		},
		client: message.client,
		channel: message.channel,
		user: message.author,
		member: message.member,
	};
}

async function handleCommandError(message, error) {
	console.error('[WARN] Message command execution error:', error);

	const errorMessage = {
		content: 'There was an error while executing this command!',
		flags: MessageFlags.Ephemeral,
	};

	try {
		await message.reply(errorMessage);
	}
	catch (replyError) {
		console.error('[WARN] Failed to send error message:', replyError);
	}
}