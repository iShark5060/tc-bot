module.exports = {
	name: 'tcpurgechannel',
	description: 'Delete all messages in current channel',
	args: true,
	argsmin: 1,
	argsmax: 1,
	aliases: ['tcchearchannel', 'tcyeet'],
	usage: '<channelname>',
	example: 'purge',
	guildOnly: true,
	async execute(client, message, args) {
		// Check if user has enough rights to use the command.
		if (!message.member.roles.cache.some(role => role.name === client.config.adminRole)) {
			message.reply('you don\'t have enough rights to use this command.');
			return client.ChannelLog(`user ${message.author} tried to use ${this.name}. Failed due to insufficient rights.`, 1, true);
		}

		// command has to be used inside "tc-" channel.
		const targetChannel = message.channel;
		if (targetChannel.name.substring(0, 3) !== 'tc-') {
			return message.reply(`"${message.channel}" is not a valid channel! Please run in a Theorycrafters channel.`);
		}

		const fetched = await targetChannel.fetch({ limit: 100 });
		if (args[0] === 'purge') {
			// Delete Messages with bulkDelete. Hard Limit on that is 100.
			try {
				await targetChannel.bulkDelete(fetched);
			}
			catch (error) {
				message.channel.send(`Error: \`\`\`${error}\`\`\``);
			}
		}
		else if (args[0] === 'clear') {
			// Delete messages one by one, might be rate limited .. who knows, documentation is nonexistent.
			try {
				// fetched.forEach(async f => {
				for (let i = 0, len = fetched.length; i < len; i++) {
					fetched[i].delete();
					console.log('meh: ' + i);
					// });
				}
				console.log('meh?');
			}
			catch (error) {
				message.channel.send(`Error: \`\`\`${error}\`\`\``);
			}
		}
		else {
			// Invalid argument used.
			return message.reply('You have not used the correct argument to start the process. RTFM probably.');
		}
	},
};