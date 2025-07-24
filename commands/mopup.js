const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('mopup')
		.setDescription('Time unitl next mopup'),
	async execute(interaction) {
		let muActive;
		let muColor;
		let muText;
		let muTime;

		let starttime;
		let endtime;
		const ttoday = Date.now();
		const timeoffset = new Date().getTimezoneOffset();
		const thours = Math.ceil((ttoday + timeoffset * 60 * 1000) / (60 * 60 * 1000)) - 8;
		const today = Math.floor(thours / 24);

		if (today % 2 == 0) {
			// multiplier: minutes * minutes * days ; offset is 26 hours after day start of the day from server reset
			starttime = (today * 60 * 60 * 24 + 24 * 60 * 60) * 1000;
			endtime = starttime + 8 * 60 * 60 * 1000;
		}
		else {
			// multiplier: minutes * minutes * days ; offset is 8 hours after day start of the day from server reset
			starttime = (today * 60 * 60 * 24 + 8 * 60 * 60) * 1000;
			endtime = starttime + 16 * 60 * 60 * 1000;
		}

		// calculate time difference between now (utctime) and starttime
		// convert utctime into unix
		const currenttime = (new Date(new Date().toISOString()).valueOf() / 1000).toFixed(0) * 1000;

		const deltastart = starttime - currenttime;
		const deltaend = endtime - currenttime;

		if (deltastart < 0) {
			if (deltaend > 0) {
				muActive = 'ACTIVE';
				muText = 'close';
				muColor = 8311585;

				// calculate remaining time window, use deltaend and convert into hh:mm:ss
				muTime = new Date(deltaend).toISOString().substr(11, 8);
			}
			else {
				muActive = 'INACTIVE';
				muText = 'open';
				muColor = 13632027;

				// calculate next window start, depends of current day
				if (today % 2 == 0) {
					// cannot happen,
				}
				else {
					muTime = new Date(deltaend + 24 * 60 * 60).toISOString().substr(11, 8);
				}
			}
		}
		else {
			muActive = 'INACTIVE';
			muText = 'open';
			muColor = 13632027;
			// calculate the time remaining, use deltastart and convert into hh:mm:ss
			muTime = new Date(deltastart).toISOString().substr(11, 8);
		}

		const reply = new EmbedBuilder()
			.setColor(muColor)
			.addFields(
				{ name: `Mopup is: ${muActive}`, value: '|' },
				{ name: `Time until ${muText}`, value: `\`\`\`asciidoc\n${muTime}\`\`\`` },
			);

		return interaction.reply({ embeds: [reply] });
	},
};