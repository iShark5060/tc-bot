const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require('discord.js');
const { numberWithCommas } = require('../../helper/formatters.js');
const { getSheetRowsCached } = require('../../helper/sheetsCache.js');

const RESOURCE_TYPES = [
	'foodCost',
	'partsCost',
	'eleCost',
	'gasCost',
	'cashCost',
];
const SPECIAL_TYPES = ['smCost', 'ucCost', 'hcCost'];
const OTHER_TYPES = [
	'mchealCost',
	'arkHP',
	'powerLost',
	'kePoints',
	'hePoints',
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('healtroop')
		.setDescription('Calculate cost to heal troops')
		.addIntegerOption((option) =>
		option
			.setName('amount')
			.setDescription('How many troops are injured')
			.setRequired(true)
		)
		.addIntegerOption((option) =>
		option
			.setName('tier')
			.setDescription('Tier of the injured units')
			.setRequired(true)
		)
		.addStringOption((option) =>
		option
			.setName('type')
			.setDescription('Select the unit type')
			.addChoices(
			{ name: 'Infantry', value: 'Infantry' },
			{ name: 'Walker', value: 'Walker' },
			{ name: 'Airship', value: 'Airship' }
			)
			.setRequired(true)
		),
	examples: [
		'/healtroop amount:100 tier:12 type:Infantry',
		'/healtroop amount:50 tier:10 type:Walker',
	],

	async execute(interaction) {
		const troopAmount = interaction.options.getInteger('amount');
		const troopTier = interaction.options.getInteger('tier');
		const troopType = interaction.options.getString('type');

		if (troopTier > 12) {
		return interaction.reply({
			content: 'We currently only have Tier 12 :)',
			flags: MessageFlags.Ephemeral,
		});
		}

		await interaction.deferReply();

		const rows = await getSheetRowsCached(
		interaction.client.GoogleSheet,
		process.env.GOOGLE_SHEET_ID
		);
		const troopData = findTroopData(rows, troopTier, troopType);

		if (!troopData) {
		return interaction.editReply({ content: 'Troop data not found!' });
		}

		const calculations = calculateHealingCosts(troopData, troopAmount);
		const embed = createHealingEmbed(troopData, troopAmount, calculations);

		await interaction.editReply({ embeds: [embed] });
	},
};

function findTroopData(rows, tier, type) {
	return rows.find(
		(row) =>
		row.get('troopTier') == tier &&
		row.get('troopType') === type &&
		row.get('isNPC') === 'N'
	);
}

function getModifier(totalUnits) {
	if (totalUnits >= 3501) return 0.25;
	if (totalUnits >= 1501) return 0.22;
	if (totalUnits >= 901) return 0.19;
	if (totalUnits >= 501) return 0.17;
	if (totalUnits >= 201) return 0.15;
	return 0.1;
}

function getOptimalModifier(troopUnits) {
	if (troopUnits < 201) return { modifier: 0.1, units: 200 };
	if (troopUnits < 501) return { modifier: 0.15, units: 500 };
	if (troopUnits < 901) return { modifier: 0.17, units: 900 };
	if (troopUnits < 1501) return { modifier: 0.19, units: 1500 };
	if (troopUnits < 3501) return { modifier: 0.22, units: 3500 };
	return { modifier: 0.25, units: -1 };
	}

function calculateResourceCost(costString, amount, modifier) {
	if (!costString) return null;
	const baseCost = parseInt(costString.replace(/,/g, ''));
	return Math.ceil(baseCost * amount * modifier);
}

function calculateHealingCosts(troopData, troopAmount) {
	const totalUnits = troopAmount * troopData.get('troopUnits');
	const modifier = getModifier(totalUnits);
	const optimal = getOptimalModifier(troopData.get('troopUnits'));
	const optQty = Math.max(
		1,
		optimal.units === -1
		? troopAmount
		: Math.floor(optimal.units / troopData.get('troopUnits'))
	);

	const costs = {
		resources: {},
		special: {},
		other: {},
		totalUnits,
		modifier,
		optimal,
		optQty,
	};

	['foodCost', 'partsCost', 'eleCost', 'gasCost', 'cashCost'].forEach((type) => {
		const cost = calculateResourceCost(troopData.get(type), troopAmount, modifier);
		const optCost = calculateResourceCost(
		troopData.get(type),
		troopAmount,
		optimal.modifier
		);
		if (cost !== null) costs.resources[type] = { current: cost, optimal: optCost };
	});

	['smCost', 'ucCost', 'hcCost'].forEach((type) => {
		const cost = calculateResourceCost(troopData.get(type), troopAmount, modifier);
		let optPerChunk = calculateResourceCost(
		troopData.get(type),
		1,
		optimal.modifier
		);
		if (cost !== null && optPerChunk !== null) {
		if (optPerChunk < 1) optPerChunk = 1;
		const chunks = optimal.units === -1 ? 1 : Math.ceil(troopAmount / optQty);
		costs.special[type] = { current: cost, optimal: optPerChunk * chunks };
		}
	});

	['mchealCost', 'arkHP', 'powerLost', 'kePoints', 'hePoints'].forEach((type) => {
		const value = troopData.get(type);
		if (value) {
		costs.other[type] = Math.ceil(
			parseInt(value.replace(/,/g, '')) * troopAmount
		);
		}
	});

	return costs;
}

function formatCostText(costs, isOptimal = false) {
	const labels = {
		foodCost: 'Food::',
		partsCost: 'Parts::',
		eleCost: 'Ele::',
		gasCost: 'Gas::',
		cashCost: 'Cash::',
		smCost: 'SM::',
		ucCost: 'UC::',
		hcCost: 'HC::',
	};

	let text = '';
	Object.entries({ ...costs.resources, ...costs.special }).forEach(
		([type, cost]) => {
		const value = isOptimal ? cost.optimal : cost.current;
		text += `\n${labels[type].padEnd(7)} ${numberWithCommas(value)}`;
		}
	);
	return text;
}

function formatOtherStats(costs) {
	const labels = {
		mchealCost: 'MC Heal::',
		arkHP: 'Massacre Dmg::',
		powerLost: 'Power::',
		kePoints: 'KE Points::',
		hePoints: 'Heal Points::',
	};

	let text = '';
	Object.entries(costs.other).forEach(([type, value]) => {
		text += `\n${labels[type].padEnd(14)} ${numberWithCommas(value)}`;
	});
	return text;
}

function createHealingEmbed(troopData, troopAmount, costs) {
	const reply = new EmbedBuilder().setColor(0xffffff).setTitle('Healing cost:');

	const troopName = troopData.get('troopName');
	const troopTier = troopData.get('troopTier');
	const troopType = troopData.get('troopType');

	const fields = [
		{
		name: 'Healing:',
		value: `\`\`\`asciidoc\n${numberWithCommas(
			troopAmount
		)}x ${troopName} (T${troopTier} ${troopType})\`\`\``,
		},
		{
		name: 'Total Units:',
		value: `\`\`\`asciidoc\n${numberWithCommas(
			costs.totalUnits
		)} @ ${costs.modifier * 100}% of training costs.${formatCostText(
			costs
		)}\`\`\``,
		},
		{
		name: 'Other Stats:',
		value: `\`\`\`asciidoc${formatOtherStats(costs)}\`\`\``,
		},
	];

	if (costs.optimal.modifier < costs.modifier) {
		let tipText = `${costs.optQty}x troop${
		costs.optQty > 1 ? 's' : ''
		} at a time to heal at ${costs.optimal.modifier * 100}% of training costs:`;
		let warning = '';
		if (Object.keys(costs.special).some((type) => SPECIAL_TYPES.includes(type))) {
		warning = 'Save rss but may cost more sm/uc/hc\n';
		}
		fields.push({
		name: 'TIP:',
		value: `\`\`\`asciidoc\nHeal ${tipText}\n${warning}--${formatCostText(
			costs,
			true
		)}\`\`\``,
		});
	}

	reply.addFields(fields);
	return reply;
}