const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('mopup')
		.setDescription('Time until next mopup'),

	async execute(interaction) {
		const mopupInfo = calculateMopupTiming();
		const embed = createMopupEmbed(mopupInfo);

		await interaction.reply({ embeds: [embed] });
	},
};

function calculateMopupTiming() {
	const now = Date.now();
	const timeOffset = new Date().getTimezoneOffset();
	const hoursFromEpoch = Math.ceil((now + timeOffset * 60 * 1000) / (60 * 60 * 1000)) - 8;
	const daysSinceEpoch = Math.floor(hoursFromEpoch / 24);
	const currentTime = Math.floor(new Date().valueOf() / 1000) * 1000;

	const { startTime, endTime } = getMopupWindow(daysSinceEpoch);
	const deltaStart = startTime - currentTime;
	const deltaEnd = endTime - currentTime;

	return determineMopupStatus(deltaStart, deltaEnd, daysSinceEpoch);
}

function getMopupWindow(day) {
	const dayInMs = 24 * 60 * 60 * 1000;
	const hourInMs = 60 * 60 * 1000;

	if (day % 2 === 0) {
	// Even days: 26 hours after day start, 8-hour window
		const startTime = (day * dayInMs + 26 * hourInMs);
		const endTime = startTime + 8 * hourInMs;
		return { startTime, endTime };
	}
	else {
	// Odd days: 8 hours after day start, 16-hour window
		const startTime = (day * dayInMs + 8 * hourInMs);
		const endTime = startTime + 16 * hourInMs;
		return { startTime, endTime };
	}
}

function determineMopupStatus(deltaStart, deltaEnd, day) {
	if (deltaStart < 0) {
		if (deltaEnd > 0) {
			return {
				status: 'ACTIVE',
				color: 8311585,
				time: formatTime(deltaEnd),
			};
		}
		else {
			const nextWindowTime = day % 2 === 0
				? deltaEnd + 24 * 60 * 60 * 1000
				: deltaEnd + 24 * 60 * 60 * 1000;

			return {
				status: 'INACTIVE',
				color: 13632027,
				time: formatTime(nextWindowTime),
			};
		}
	}
	else {
		return {
			status: 'INACTIVE',
			color: 13632027,
			time: formatTime(deltaStart),
		};
	}
}

function formatTime(milliseconds) {
	return new Date(Math.abs(milliseconds)).toISOString().slice(11, 19);
}

function createMopupEmbed({ status, color, time }) {
	return new EmbedBuilder()
		.setColor(color)
		.setTitle('Mopup')
		.addFields(
			{ name: 'Status:', value: `\`\`\`asciidoc\n${status}\`\`\`` },
			{ name: 'Time remaining:', value: `\`\`\`asciidoc\n${time}\`\`\`` },
		);
}