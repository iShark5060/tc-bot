const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('healtroop')
		.setDescription('Calculate cost to heal troops')
		.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('How many troops are injured')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('tier')
				.setDescription('Tier of the injured units')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('type')
				.setDescription('Select the unit type')
				.addChoices(
					{ name: 'Infantry', value: 'Infantry' },
					{ name: 'Walker', value: 'Walker' },
					{ name: 'Airship', value: 'Airship' },
				)
				.setRequired(true),
		),

	async execute(interaction) {
		await interaction.deferReply();

		const troopAmount = interaction.options.getInteger('amount');
		const troopTier = interaction.options.getInteger('tier');
		const troopType = interaction.options.getString('type');

		if (troopTier > 12) {
			return interaction.editReply({
				content: 'We currently only have Tier 12 :)',
				flags: MessageFlags.Ephemeral,
			});
		}

		const sheet = interaction.client.GoogleSheet.sheetsById[891063687];
		const rows = await sheet.getRows();
		const troopData = findTroopData(rows, troopTier, troopType);

		if (!troopData) {
			return interaction.editReply({
				content: 'Troop data not found!',
				flags: MessageFlags.Ephemeral,
			});
		}

		const calculations = calculateHealingCosts(troopData, troopAmount);
		const embed = createHealingEmbed(troopData, troopAmount, calculations);

		await interaction.editReply({ embeds: [embed] });
	},
};

function numberWithCommas(x) {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function findTroopData(rows, tier, type) {
	return rows.find(
		(row) =>
			row.get('troopTier') == tier &&
			row.get('troopType') === type &&
			row.get('isNPC') === 'N',
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
	const optQty = Math.floor(optimal.units / troopData.get('troopUnits'));

	const resourceTypes = [
		'foodCost',
		'partsCost',
		'eleCost',
		'gasCost',
		'cashCost',
	];
	const specialTypes = ['smCost', 'ucCost', 'hcCost'];
	const otherTypes = ['mchealCost', 'arkHP', 'powerLost', 'kePoints', 'hePoints'];

	const costs = {
		resources: {},
		special: {},
		other: {},
		totalUnits,
		modifier,
		optimal,
		optQty,
	};

	// Calculate resource costs
	resourceTypes.forEach((type) => {
		const cost = calculateResourceCost(troopData.get(type), troopAmount, modifier);
		const optCost = calculateResourceCost(
			troopData.get(type),
			troopAmount,
			optimal.modifier,
		);
		if (cost !== null) {
			costs.resources[type] = { current: cost, optimal: optCost };
		}
	});

	// Calculate special costs (SM/UC/HC)
	specialTypes.forEach((type) => {
		const cost = calculateResourceCost(troopData.get(type), troopAmount, modifier);
		let optCost = calculateResourceCost(
			troopData.get(type),
			1,
			optimal.modifier,
		);
		if (cost !== null) {
			if (optCost < 1) optCost = 1;
			optCost = optCost * Math.ceil(troopAmount / optQty);
			costs.special[type] = { current: cost, optimal: optCost };
		}
	});

	// Calculate other stats
	otherTypes.forEach((type) => {
		const value = troopData.get(type);
		if (value) {
			costs.other[type] = Math.ceil(
				parseInt(value.replace(/,/g, '')) * troopAmount,
			);
		}
	});

	return costs;
}

function formatCostText(costs, isOptimal = false) {
	const resourceLabels = {
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

	Object.entries(costs.resources).forEach(([type, cost]) => {
		const value = isOptimal ? cost.optimal : cost.current;
		text += `\n${resourceLabels[type].padEnd(7)} ${numberWithCommas(value)}`;
	});

	Object.entries(costs.special).forEach(([type, cost]) => {
		const value = isOptimal ? cost.optimal : cost.current;
		text += `\n${resourceLabels[type].padEnd(7)} ${numberWithCommas(value)}`;
	});

	return text;
}

function formatOtherStats(costs) {
	const otherLabels = {
		mchealCost: 'MC Heal::',
		arkHP: 'Massacre Dmg::',
		powerLost: 'Power::',
		kePoints: 'KE Points::',
		hePoints: 'Heal Points::',
	};

	let text = '';
	Object.entries(costs.other).forEach(([type, value]) => {
		text += `\n${otherLabels[type].padEnd(14)} ${numberWithCommas(value)}`;
	});

	return text;
}

function createHealingEmbed(troopData, troopAmount, costs) {
	const reply = new EmbedBuilder()
		.setColor(16777215)
		.setTitle('Healing cost:');

	const troopName = troopData.get('troopName');
	const troopTier = troopData.get('troopTier');
	const troopType = troopData.get('troopType');

	const fields = [
		{
			name: 'Healing:',
			value: `\`\`\`asciidoc\n${numberWithCommas(
				troopAmount,
			)}x ${troopName} (T${troopTier} ${troopType})\`\`\``,
		},
		{
			name: 'Total Units:',
			value: `\`\`\`asciidoc\n${numberWithCommas(
				costs.totalUnits,
			)} @ ${costs.modifier * 100}% of training costs.${formatCostText(
				costs,
			)}\`\`\``,
		},
		{
			name: 'Other Stats:',
			value: `\`\`\`asciidoc${formatOtherStats(costs)}\`\`\``,
		},
	];

	// Add optimization tip if beneficial
	if (costs.optimal.modifier < costs.modifier) {
		let tipText = `${costs.optQty}x troop`;
		if (costs.optQty > 1) tipText += 's';
		tipText += ` at a time to heal at ${costs.optimal.modifier * 100}% of training costs:`;

		let warning = '';
		if (
			Object.keys(costs.special).some((type) =>
				['hcCost', 'ucCost', 'smCost'].includes(type),
			)
		) {
			warning = 'Save rss but may cost more sm/uc/hc\n';
		}

		fields.push({
			name: 'TIP:',
			value: `\`\`\`asciidoc\nHeal ${tipText}\n${warning}--${formatCostText(
				costs,
				true,
			)}\`\`\``,
		});
	}

	reply.addFields(fields);
	return reply;
}