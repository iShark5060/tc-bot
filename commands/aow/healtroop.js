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
const OTHER_TYPES = ['mchealCost', 'arkHP', 'powerLost', 'kePoints', 'hePoints'];

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
  examples: ['/healtroop amount:100 tier:12 type:Infantry', '/healtroop amount:50 tier:10 type:Walker'],

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

    const troopRows = findTroopRows(rows, troopTier, troopType);

    if (troopRows.length === 0) {
      return interaction.editReply({ content: 'Troop data not found!' });
    }

    // Limit to avoid overlong embeds
    const MAX_ROWS = 10;
    const truncated = troopRows.length > MAX_ROWS;
    const selectedRows = troopRows.slice(0, MAX_ROWS);

    const perRowCalcs = selectedRows.map((row) => ({
      row,
      calc: calculateHealingCosts(row, troopAmount),
    }));

		const filtered = perRowCalcs.filter((x) => x.calc && x.calc.hasData === true);
		if (filtered.length === 0) {
		  return interaction.editReply({
		    content:
		      'No usable troop data found for that selection (rows are empty or missing costs).',
		  });
		}
	
		const embed = createMultiHealingEmbed(
      troopTier,
      troopType,
      troopAmount,
      filtered,
      truncated ? troopRows.length - MAX_ROWS : 0
    );

    await interaction.editReply({ embeds: [embed] });
  },
};

function findTroopRows(rows, tier, type) {
  return rows.filter(
    (row) =>
      String(row.get('troopTier')) === String(tier) &&
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
  const baseCost = parseInt(String(costString).replace(/,/g, ''), 10);
  if (!Number.isFinite(baseCost)) return null;
  return Math.ceil(baseCost * amount * modifier);
}

function calculateHealingCosts(troopData, troopAmount) {
  const unitsPerTroop = parseInt(String(troopData.get('troopUnits') || '0'), 10);
  if (!Number.isFinite(unitsPerTroop) || unitsPerTroop <= 0) {
    return null;
  }

  const totalUnits = troopAmount * unitsPerTroop;
  const modifier = getModifier(totalUnits);
  const optimal = getOptimalModifier(unitsPerTroop);
  const optQty = Math.max(
    1,
    optimal.units === -1
      ? troopAmount
      : Math.floor(optimal.units / unitsPerTroop)
  );

  const costs = {
    resources: {},
    special: {},
    other: {},
    totalUnits,
    modifier,
    optimal,
    optQty,
		hasData: false,
  };

  RESOURCE_TYPES.forEach((type) => {
    const cost = calculateResourceCost(
      troopData.get(type),
      troopAmount,
      modifier
    );
    const optCost = calculateResourceCost(
      troopData.get(type),
      troopAmount,
      optimal.modifier
    );
    if (cost !== null) {
      costs.resources[type] = { current: cost, optimal: optCost ?? cost };
			costs.hasData = true;
    }
  });

  SPECIAL_TYPES.forEach((type) => {
    const cost = calculateResourceCost(
      troopData.get(type),
      troopAmount,
      modifier
    );
    let optPerChunk = calculateResourceCost(
      troopData.get(type),
      1,
      optimal.modifier
    );
    if (cost !== null && optPerChunk !== null) {
      if (optPerChunk < 1) optPerChunk = 1;
      const chunks = optimal.units === -1 ? 1 : Math.ceil(troopAmount / optQty);
      costs.special[type] = {
        current: cost,
        optimal: optPerChunk * chunks,
      };
    }
  });

  OTHER_TYPES.forEach((type) => {
    const value = troopData.get(type);
    if (value) {
      const v = parseInt(String(value).replace(/,/g, ''), 10);
      if (Number.isFinite(v)) {
        costs.other[type] = Math.ceil(v * troopAmount);
				costs.hasData = true;
      }
    }
  });

  return costs.hasData ? costs : null;
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

function createMultiHealingEmbed(
  troopTier,
  troopType,
  troopAmount,
  perRowCalcs,
  truncatedCount
) {
  const embed = new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle('Healing cost:');

  // Top context field
  embed.addFields({
    name: 'Selection:',
    value:
      '```asciidoc\n' +
      `${numberWithCommas(troopAmount)}x (T${troopTier} ${troopType})\n` +
      '```',
  });

  // One section per troop row
  for (const item of perRowCalcs) {
    const troopData = item.row;
    const costs = item.calc;

    const troopName = troopData.get('troopName');
    const unitsPerTroop = troopData.get('troopUnits');
    const header =
      `${troopName} — ` +
      `${numberWithCommas(troopAmount)}x @ ` +
      `${numberWithCommas(unitsPerTroop)} units each`;

    if (!costs) {
      continue;
    }

    const body =
      '```asciidoc\n' +
      `Total Units: ${numberWithCommas(costs.totalUnits)} ` +
      `@ ${(costs.modifier * 100).toFixed(0)}% of training costs.` +
      `${formatCostText(costs)}\n` +
      '```\n' +
      '```asciidoc\n' +
      'Other Stats:' +
      `${formatOtherStats(costs)}` +
      '```';

    let tip = '';
    if (costs.optimal.modifier < costs.modifier) {
      const tipText = `${
        costs.optQty
      }x troop${costs.optQty > 1 ? 's' : ''} at a time to heal at ${(
        costs.optimal.modifier * 100
      ).toFixed(0)}% of training costs:`;
      const warning = Object.keys(costs.special).some((t) =>
        SPECIAL_TYPES.includes(t)
      )
        ? 'Save rss but may cost more sm/uc/hc\n'
        : '';
      tip =
        '```asciidoc\n' +
        `TIP: Heal ${tipText}\n${warning}--${formatCostText(costs, true)}\n` +
        '```';
    }

    embed.addFields({
      name: header,
      value: body + tip,
    });
  }

  if (truncatedCount > 0) {
    embed.addFields({
      name: 'Note:',
      value: `Showing first ${perRowCalcs.length} matches. ` + `+${truncatedCount} more rows omitted.`,
    });
  }

  return embed;
}