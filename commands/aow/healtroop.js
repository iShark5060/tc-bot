const {
  EmbedBuilder,
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { numberWithCommas } = require('../../helper/formatters.js');
const { getSheetRowsCached } = require('../../helper/sheetsCache.js');

const TRUNCATION_LIMITS = {
  MAX_ROWS: 10,
  MAX_SELECT_OPTIONS: 25,
};

const COST_TYPES = {
  RESOURCES: ['foodCost', 'partsCost', 'eleCost', 'gasCost', 'cashCost'],
  SPECIAL: ['smCost', 'ucCost', 'hcCost', 'scCost'],
  OTHER: ['mchealCost', 'arkHP', 'powerLost', 'kePoints', 'hePoints'],
};

const MODIFIER_THRESHOLDS = [
  { units: 3501, modifier: 0.25 },
  { units: 1501, modifier: 0.22 },
  { units: 901, modifier: 0.19 },
  { units: 501, modifier: 0.17 },
  { units: 201, modifier: 0.15 },
  { units: 0, modifier: 0.1 },
];

const COST_LABELS = {
  foodCost: 'Food::',
  partsCost: 'Parts::',
  eleCost: 'Ele::',
  gasCost: 'Gas::',
  cashCost: 'Cash::',
  smCost: 'SM::',
  ucCost: 'UC::',
  hcCost: 'HC::',
  scCost: 'SC::',
  mchealCost: 'MC Heal::',
  arkHP: 'Massacre Dmg::',
  powerLost: 'Power::',
  kePoints: 'KE Points::',
  hePoints: 'Heal Points::',
};

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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rows = await getSheetRowsCached(
      interaction.client.GoogleSheet,
      process.env.GOOGLE_SHEET_ID
    );

    const troopRows = findTroopRows(rows, troopTier, troopType);
    if (troopRows.length === 0) {
      return interaction.editReply({ content: 'Troop data not found!' });
    }

    const validByName = buildValidByNameMap(troopRows, troopAmount);

    if (validByName.size === 0) {
      return interaction.editReply({
        content:
          'No usable troop data found for that selection ' +
          '(rows are empty or missing costs).',
      });
    }

    if (validByName.size > 1) {
      const embed = new EmbedBuilder()
        .setColor(0xffffff)
        .setTitle('Healing cost — choose troop')
        .setDescription(
          `Found ${validByName.size} troop variants for ` +
            `T${troopTier} ${troopType}. Choose one to see detailed costs.`
        )
        .addFields({
          name: 'Selection',
          value:
            '```asciidoc\n' +
            `${numberWithCommas(troopAmount)}x ` +
            `(T${troopTier} ${troopType})\n` +
            '```',
        });

      const options = Array.from(validByName.keys())
        .sort((a, b) => a.localeCompare(b))
        .slice(0, TRUNCATION_LIMITS.MAX_SELECT_OPTIONS)
        .map((name) => ({
          label: name.slice(0, 100),
          value: name.slice(0, 100),
        }));

      const truncated =
        validByName.size > TRUNCATION_LIMITS.MAX_SELECT_OPTIONS;

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`healtroop:${troopTier}|${troopType}|${troopAmount}`)
          .setPlaceholder('Pick a troop name…')
          .addOptions(options)
          .setMinValues(1)
          .setMaxValues(1)
      );

      const content = truncated
        ? `Showing first ${TRUNCATION_LIMITS.MAX_SELECT_OPTIONS} of ` +
          `${validByName.size} troops.`
        : undefined;

      return interaction.editReply({
        content,
        embeds: [embed],
        components: [row],
      });
    }

    const [singleName] = Array.from(validByName.keys());
    const selectedRows = validByName
      .get(singleName)
      .slice(0, TRUNCATION_LIMITS.MAX_ROWS);
    const perRowCalcs = selectedRows
      .map((row) => ({ row, calc: calculateHealingCosts(row, troopAmount) }))
      .filter((x) => x.calc && x.calc.hasData);

    const embed = createMultiHealingEmbed(
      troopTier,
      troopType,
      troopAmount,
      singleName,
      perRowCalcs,
      selectedRows.length < (validByName.get(singleName).length || 0)
        ? validByName.get(singleName).length - selectedRows.length
        : 0
    );

    return interaction.editReply({ embeds: [embed], components: [] });
  },

  async handleSelect(interaction) {
    try {
      const meta = String(interaction.customId).slice('healtroop:'.length);
      const [tierStr, type, amountStr] = meta.split('|');
      const troopTier = parseInt(tierStr, 10);
      const troopType = type;
      const troopAmount = parseInt(amountStr, 10);
      const selectedName = interaction.values?.[0];

      if (
        !Number.isFinite(troopTier) ||
        !Number.isFinite(troopAmount) ||
        !selectedName
      ) {
        return interaction.update({
          content: 'Invalid selection.',
          components: [],
        });
      }

      const rows = await getSheetRowsCached(
        interaction.client.GoogleSheet,
        process.env.GOOGLE_SHEET_ID
      );

      const troopRows = findTroopRows(rows, troopTier, troopType).filter(
        (r) => String(r.get('troopName')) === String(selectedName)
      );

      if (troopRows.length === 0) {
        return interaction.update({
          content: 'No rows found for that troop name anymore.',
          components: [],
        });
      }

      const selectedRows = troopRows.slice(0, TRUNCATION_LIMITS.MAX_ROWS);
      const perRowCalcs = selectedRows
        .map((row) => ({
          row,
          calc: calculateHealingCosts(row, troopAmount),
        }))
        .filter((x) => x.calc && x.calc.hasData);

      if (perRowCalcs.length === 0) {
        return interaction.update({
          content:
            'No usable troop data found for that selection ' +
            '(rows are empty or missing costs).',
          components: [],
        });
      }

      const embed = createMultiHealingEmbed(
        troopTier,
        troopType,
        troopAmount,
        selectedName,
        perRowCalcs,
        troopRows.length > TRUNCATION_LIMITS.MAX_ROWS
          ? troopRows.length - TRUNCATION_LIMITS.MAX_ROWS
          : 0
      );

      return interaction.update({
        content: '',
        embeds: [embed],
        components: [],
      });
    } catch (err) {
      console.error('[healtroop] handleSelect failed:', err);
      try {
        await interaction.update({
          content: 'Failed to render selection.',
          components: [],
        });
      } catch {}
    }
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

function buildValidByNameMap(rows, troopAmount) {
  const byName = new Map();
  for (const row of rows) {
    const name = (row.get('troopName') || '').trim();
    if (!name) continue;
    const calc = calculateHealingCosts(row, troopAmount);
    if (!calc || !calc.hasData) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(row);
  }
  return byName;
}

function getModifier(totalUnits) {
  for (const threshold of MODIFIER_THRESHOLDS) {
    if (totalUnits >= threshold.units) {
      return threshold.modifier;
    }
  }
  return 0.1;
}

function getOptimalModifier(troopUnits) {
  for (let i = 0; i < MODIFIER_THRESHOLDS.length - 1; i++) {
    const current = MODIFIER_THRESHOLDS[i];
    const next = MODIFIER_THRESHOLDS[i + 1];

    if (troopUnits < current.units && troopUnits >= next.units) {
      return { modifier: current.modifier, units: current.units };
    }
  }

  // Already at highest tier
  if (troopUnits >= MODIFIER_THRESHOLDS[0].units) {
    return { modifier: MODIFIER_THRESHOLDS[0].modifier, units: -1 };
  }

  // Below lowest threshold
  const lowest = MODIFIER_THRESHOLDS[MODIFIER_THRESHOLDS.length - 1];
  return { modifier: lowest.modifier, units: lowest.units };
}

function calculateResourceCost(costString, amount, modifier) {
  if (!costString) return null;
  const baseCost = parseInt(String(costString).replace(/,/g, ''), 10);
  if (!Number.isFinite(baseCost)) return null;
  return Math.ceil(baseCost * amount * modifier);
}

function calculateHealingCosts(troopData, troopAmount) {
  const unitsPerTroop = parseInt(
    String(troopData.get('troopUnits') || '0'),
    10
  );
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

  COST_TYPES.RESOURCES.forEach((type) => {
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

  COST_TYPES.SPECIAL.forEach((type) => {
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
      costs.special[type] = { current: cost, optimal: optPerChunk * chunks };
      costs.hasData = true;
    }
  });

  COST_TYPES.OTHER.forEach((type) => {
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
  let text = '';
  const allCosts = { ...costs.resources, ...costs.special };

  Object.entries(allCosts).forEach(([type, cost]) => {
    const value = isOptimal ? cost.optimal : cost.current;
    const label = COST_LABELS[type] || `${type}::`;
    text += `\n${label.padEnd(7)} ${numberWithCommas(value)}`;
  });

  return text;
}

function formatOtherStats(costs) {
  let text = '';

  Object.entries(costs.other).forEach(([type, value]) => {
    const label = COST_LABELS[type] || `${type}::`;
    text += `\n${label.padEnd(14)} ${numberWithCommas(value)}`;
  });

  return text;
}

function createMultiHealingEmbed(
  troopTier,
  troopType,
  troopAmount,
  troopName,
  perRowCalcs,
  truncatedCount
) {
  const embed = new EmbedBuilder().setColor(0xffffff).setTitle('Healing cost:');

  embed.addFields({
    name: 'Selection:',
    value:
      '```asciidoc\n' +
      `${numberWithCommas(troopAmount)}x ${troopName} ` +
      `(T${troopTier} ${troopType})\n` +
      '```',
  });

  for (const item of perRowCalcs) {
    const troopData = item.row;
    const costs = item.calc;

    if (!costs) continue;

    const unitsPerTroop = troopData.get('troopUnits');
    const header =
      `${troopData.get('troopName')} — ` +
      `${numberWithCommas(troopAmount)}x @ ` +
      `${numberWithCommas(unitsPerTroop)} units each`;

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
      const tipText =
        `${costs.optQty}x troop${costs.optQty > 1 ? 's' : ''} ` +
        `at a time to heal at ` +
        `${(costs.optimal.modifier * 100).toFixed(0)}% of training costs:`;
      const warning = Object.keys(costs.special).some((t) =>
        COST_TYPES.SPECIAL.includes(t)
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
      value:
        `Showing first ${perRowCalcs.length} matches. ` +
        `+${truncatedCount} more rows omitted.`,
    });
  }

  return embed;
}