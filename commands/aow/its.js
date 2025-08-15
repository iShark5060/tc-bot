const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { numberWithCommas } = require('../../helper/formatters.js');
const { getSheetRowsCached } = require('../../helper/sheetsCache.js');

const SHEET_ID = 891063687;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('its')
		.setDescription(
		'How many troops can I kill with Ignore Tier Suppression skills?'
		)
		.addIntegerOption((option) =>
		option.setName('level').setDescription('iTS Skill Level').setRequired(true)
		)
		.addIntegerOption((option) =>
		option
			.setName('leadership')
			.setDescription('Leadership amount')
			.setRequired(true)
		)
		.addIntegerOption((option) =>
		option.setName('tier').setDescription('Target Tier').setRequired(true)
		)
		.addIntegerOption((option) =>
		option
			.setName('tdr')
			.setDescription('Target Total Damage Reduction amount')
		),
	examples: [
		'/its level:30 leadership:500000 tier:12',
		'/its level:25 leadership:300000 tier:10 tdr:20',
	],

	async execute(interaction) {
		await interaction.deferReply();

		const skillLevel = interaction.options.getInteger('level');
		const leadership = interaction.options.getInteger('leadership');
		const targetTier = interaction.options.getInteger('tier');
		const tdr = interaction.options.getInteger('tdr') || 0;

		if (skillLevel > 60) {
		return interaction.editReply({
			content:
			`You entered skill level ${skillLevel}. Was that intended? ` +
			`Because it's not possible, but it would be REALLY nice if it were...`,
			ephemeral: true,
		});
		}

		const rows = await getSheetRowsCached(
		interaction.client.GoogleSheet,
		SHEET_ID
		);

		const kills = calculateKills(rows, targetTier, skillLevel, leadership, tdr);
		const embed = createItsEmbed(leadership, skillLevel, tdr, kills);

		await interaction.editReply({ embeds: [embed] });
	},
};

function calculateKills(rows, targetTier, skillLevel, leadership, tdr) {
	return rows
		.filter((row) => row.get('troopTier') == targetTier)
		.map((row) => {
		const troopUnits = row.get('troopUnits') || -1;
		const numKills = Math.floor(
			(0.005 * leadership * skillLevel * (100 - tdr)) / 100 / troopUnits
		);
		const troopType = row
			.get('troopType')
			.replace('Infantry', 'INF')
			.replace('Walker', 'WLK')
			.replace('Airship', 'AIR');
		return {
			count: numKills,
			name: row.get('troopName'),
			tier: targetTier,
			type: troopType,
		};
	});
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
	return new EmbedBuilder()
		.setColor(0xffffff)
		.setTitle('Ignore Tier Suppression')
		.addFields({
		name: `${numberWithCommas(
			leadership
		)} leadership with level ${skillLevel} iTS skill vs ${tdr}% TDR can kill:`,
		value: `\`\`\`\n${formatKillsList(kills)}\`\`\``,
	});
}