const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { numberWithCommas } = require('../../helper/formatters.js');

const LEVELS = [0, 10, 13, 20, 30, 40, 50];
const MULTIPLIERS = [1, 2, 2.3, 3, 4, 5, 6];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gearcheck')
		.setDescription('Calculate stat at base and +10/13/20/30/40/50')
		.addNumberOption((option) =>
			option.setName('stat').setDescription('Current stat amount').setRequired(true)
		)
		.addIntegerOption((option) =>
			option.setName('level').setDescription('Current upgrade level').setRequired(true)
		),
	examples: [
		'/gearcheck stat:120 level:20',
		'/gearcheck stat:85.5 level:10',
	],

	async execute(interaction) {
		await interaction.deferReply();

		const statValue = interaction.options.getNumber('stat');
		const gearLevel = interaction.options.getInteger('level');

		const calculations = calculateGearStats(statValue, gearLevel);
		const embed = createGearEmbed(statValue, gearLevel, calculations);

		await interaction.editReply({ embeds: [embed] });
	},
};

function calculateGearStats(currentStat, currentLevel) {
	const baseStat = currentStat / (1 + currentLevel / 10);
	return LEVELS.reduce((acc, level, index) => {
		acc[level] = (baseStat * MULTIPLIERS[index]).toFixed(2);
		return acc;
	}, {});
}

function createGearEmbed(currentStat, currentLevel, calculations) {
	const calculatedText = Object.entries(calculations)
		.map(([level, stat]) => `+${level}:: ${numberWithCommas(stat)}%`)
		.join('\n');

	return new EmbedBuilder()
		.setColor(0xffffff)
		.setTitle('Gearcheck')
		.addFields(
			{
				name: 'Current stat:',
				value: `\`\`\`asciidoc\n+${currentLevel}: ${numberWithCommas(
					currentStat.toFixed(2)
				)}%\`\`\``,
			},
			{
				name: 'Calculated:',
				value: `\`\`\`asciidoc\n${calculatedText}\`\`\``,
			}
		);
}