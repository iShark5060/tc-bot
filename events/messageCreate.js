const { Events } = require('discord.js');
const { handleMessageError } = require('../helper/errorHandler.js');
const { calculateMopupTiming } = require('../helper/mopup.js');

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		if (!shouldProcessMessage(message)) return;

		if (message.content === '!tcmu') {
			try {
				const { status, color, time } = calculateMopupTiming();
				await message.channel.send({
					embeds: [
						{
							color,
							title: 'Mopup',
							fields: [
								{ name: 'Status:', value: `\`\`\`asciidoc\n${status}\`\`\`` },
								{
									name: 'Time remaining:',
									value: `\`\`\`asciidoc\n${time}\`\`\``,
								},
							],
						},
					],
				});
			} catch (error) {
				await handleMessageError(message, error);
			}
		}
	},
};

function shouldProcessMessage(message) {
	return message.channel.name === 'tc-autobot' && !message.author.bot;
}