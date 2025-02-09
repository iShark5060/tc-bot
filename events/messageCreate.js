const { Events, MessageFlags } = require('discord.js');
const ocrSpaceApi = require('ocr-space-api');

module.exports = {
	name: Events.MessageCreate,
	async execute(interaction) {
		if (interaction.channel.name == "albums" || interaction.channel.name == "please_kindly_know") {
			if (interaction.attachments) {
				interaction.attachments.forEach(a => {
				console.log(`new attachment: ${a.url}`);
					// Run and wait the result
					var options = {
						apikey: process.env.OCRSPACEKEY,
						language: 'eng',
						imageFormat: 'image/png',
						isOverlayRequired: true
					};
					imageFormat = 'image/' + a.url.split(".").pop();
					ocrSpaceApi.parseImageFromUrl(a.url, options)
					.then(function (parsedResult) {
						interaction.reply("OCR Text:\n```\n" + parsedResult.parsedText + "\n```");
					}).catch(function (err) {
						console.log('ERROR:', err);
					});
				});
			}
		} else if (interaction.channel.name == "tc-autobot") {
			const command = interaction.client.commands.get(interaction.commandName);
			if (!interaction.content == "!tcmu") return;
			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
				} else {
					await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
				}
			}
		}
	},
};