import { EmbedBuilder, MessageFlags, SlashCommandBuilder, Colors, type ChatInputCommandInteraction } from 'discord.js';
import { numberWithCommas } from '../../helper/formatters.js';
import { getSheetRowsCached } from '../../helper/sheetsCache.js';
import type { Command, KillResult, TroopRow, ExtendedClient } from '../../types/index.js';

const its: Command = {
  data: new SlashCommandBuilder()
    .setName('its')
    .setDescription(
      'How many troops can I kill with Ignore Tier Suppression skills?',
    )
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
      option.setName('tier').setDescription('Target Tier').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('tdr')
        .setDescription('Target Total Damage Reduction amount'),
    ),
  examples: [
    '/its level:30 leadership:500000 tier:12',
    '/its level:25 leadership:300000 tier:10 tdr:20',
  ],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const skillLevel = interaction.options.getInteger('level');
    const leadership = interaction.options.getInteger('leadership');
    const targetTier = interaction.options.getInteger('tier');
    const inputTdr = interaction.options.getInteger('tdr');
    const tdr = Math.min(100, Math.max(0, inputTdr ?? 0));

    if (!skillLevel || skillLevel > 60) {
      await interaction.reply({
        content: `You entered skill level ${skillLevel}. Was that intended? Because it's not possible, but it would be REALLY nice if it were...`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!leadership || !targetTier) {
      await interaction.reply({
        content: 'Missing required parameters',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const rows = await getSheetRowsCached(
      (interaction.client as ExtendedClient).GoogleSheet,
      process.env.GOOGLE_SHEET_ID || '',
    );

    const kills = calculateKills(rows, targetTier, skillLevel, leadership, tdr);

    if (kills.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Ignore Tier Suppression')
            .setDescription(
              'No usable troop data found (rows are empty, invalid, or would result in 0 kills).',
            ),
        ],
      });
      return;
    }

    const embed = createItsEmbed(leadership, skillLevel, tdr, kills);

    await interaction.editReply({ embeds: [embed] });
  },
};

function calculateKills(
  rows: TroopRow[],
  targetTier: number,
  skillLevel: number,
  leadership: number,
  tdr: number,
): KillResult[] {
  const DAMAGE_COEFFICIENT = 0.005;
  const coef =
    DAMAGE_COEFFICIENT * leadership * skillLevel * ((100 - tdr) / 100);

  const matches = rows.filter(
    (row) =>
      String(row.get('troopTier')) === String(targetTier) &&
      row.get('isNPC') === 'N',
  );

  return matches
    .map((row): KillResult | null => {
      const unitsStr = row.get('troopUnits');
      const units = parseInt(String(unitsStr || '0'), 10);
      if (!Number.isFinite(units) || units <= 0) return null;

      const name = String(row.get('troopName') || '').trim();
      if (!name) return null;

      const numKills = Math.floor(coef / units);
      if (numKills <= 0) return null;

      const troopType =
        String(row.get('troopType') || '')
          .replace('Infantry', 'INF')
          .replace('Walker', 'WLK')
          .replace('Airship', 'AIR') || 'UNK';

      return {
        count: numKills,
        name,
        tier: targetTier,
        type: troopType,
      };
    })
    .filter((k): k is KillResult => k !== null)
    .sort((a, b) => b.count - a.count);
}

function formatKillsList(kills: KillResult[]): string {
  return kills
    .map((kill) => {
      const count = numberWithCommas(kill.count);
      return `- ${count}x ${kill.name} (T${kill.tier} ${kill.type})`;
    })
    .join('\n');
}

function createItsEmbed(
  leadership: number,
  skillLevel: number,
  tdr: number,
  kills: KillResult[],
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.White)
    .setTitle('Ignore Tier Suppression')
    .addFields({
      name:
        `${numberWithCommas(leadership)} leadership with level ${skillLevel} ` +
        `iTS skill vs ${tdr}% TDR can kill:`,
      value: `\`\`\`\n${formatKillsList(kills)}\`\`\``,
    });
}

export default its;