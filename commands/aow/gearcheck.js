const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gearcheck')
		.setDescription('Calculate stat at base and +10/13/20/30/40/50')
		.addNumberOption((option) =>
			option
				.setName('stat')
				.setDescription('Current stat amount')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('level')
				.setDescription('Current upgrade level')
				.setRequired(true),
		),

	async execute(interaction) {
		await interaction.deferReply();

		const statValue = parseFloat(interaction.options.getNumber('stat')).toFixed(2);
		const gearLevel = interaction.options.getInteger('level');

		const calculations = calculateGearStats(statValue, gearLevel);
		const embed = createGearEmbed(statValue, gearLevel, calculations);

		await interaction.editReply({ embeds: [embed] });
	},
};

function calculateGearStats(currentStat, currentLevel) {
	const baseStat = parseFloat(currentStat) / (1 + currentLevel / 10);

	const levels = [0, 10, 13, 20, 30, 40, 50];
	const multipliers = [1, 2, 2.3, 3, 4, 5, 6];

	const calculations = {};

	levels.forEach((level, index) => {
		calculations[level] = (baseStat * multipliers[index]).toFixed(2);
	});

	return calculations;
}

function createGearEmbed(currentStat, currentLevel, calculations) {
	const calculatedText = Object.entries(calculations)
		.map(([level, stat]) => `+${level}:: ${stat}%`)
		.join('\n');

	return new EmbedBuilder()
		.setColor(16777215)
		.setTitle('Gearcheck')
		.addFields(
			{
				name: 'Current stat:',
				value: `\`\`\`asciidoc\n+${currentLevel}: ${currentStat}%\`\`\``,
			},
			{
				name: 'Calculated:',
				value: `\`\`\`asciidoc\n${calculatedText}\`\`\``,
			},
		);
}