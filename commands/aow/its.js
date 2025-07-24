const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('its')
		.setDescription('How many troops can I kill with Ignore Tier Suppression skills?')
		.addIntegerOption((option) =>
			option
				.setName('level')
				.setDescription('iTS Skill Level')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('leadership')
				.setDescription('Leadership amount')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('tier')
				.setDescription('Target Tier')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('tdr')
				.setDescription('Target Total Damage Reduction amount'),
		),

	async execute(interaction) {
		await interaction.deferReply();

		const skillLevel = interaction.options.getInteger('level');
		const leadership = interaction.options.getInteger('leadership');
		const targetTier = interaction.options.getInteger('tier');
		const tdr = interaction.options.getInteger('tdr') || 0;

		if (skillLevel > 60) {
			return interaction.editReply({
				content: `You entered skill level ${skillLevel}. Was that intended? Because it's not possible, but it would be REALLY nice if it were...`,
				ephemeral: true,
			});
		}

		const sheet = interaction.client.GoogleSheet.sheetsById[891063687];
		const rows = await sheet.getRows();

		const killCalculations = calculateKills(rows, targetTier, skillLevel, leadership, tdr);
		const embed = createItsEmbed(leadership, skillLevel, tdr, killCalculations);

		await interaction.editReply({ embeds: [embed] });
	},
};

function numberWithCommas(x) {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function calculateKills(rows, targetTier, skillLevel, leadership, tdr) {
	const kills = [];

	rows.forEach((row) => {
		if (row.get('troopTier') == targetTier) {
			const troopUnits = row.get('troopUnits') || -1;
			const numKills = Math.floor(
				(0.005 * leadership * skillLevel * (100 - tdr)) / 100 / troopUnits,
			);

			const troopType = row.get('troopType')
				.replace('Infantry', 'INF')
				.replace('Walker', 'WLK')
				.replace('Airship', 'AIR');

			kills.push({
				count: numKills,
				name: row.get('troopName'),
				tier: targetTier,
				type: troopType,
			});
		}
	});

	return kills;
}

function formatKillsList(kills) {
	return kills
		.map((kill) => {
			const count = kill.count < 0 ? '??' : numberWithCommas(kill.count);
			return `- ${count}x ${kill.name} (T${kill.tier} ${kill.type})`;
		})
		.join('\n');
}

function createItsEmbed(leadership, skillLevel, tdr, kills) {
	const killsList = formatKillsList(kills);

	return new EmbedBuilder()
		.setColor(16777215)
		.setTitle('Ignore Tier Suppression')
		.addFields({
			name: `${numberWithCommas(leadership)} leadership with level ${skillLevel} iTS skill vs ${tdr}% TDR can kill:`,
			value: `\`\`\`\n${killsList}\`\`\``,
		});
}