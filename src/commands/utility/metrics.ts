import { SlashCommandBuilder, EmbedBuilder, Colors, type ChatInputCommandInteraction } from 'discord.js';
import { BOT_ICON_URL, METRICS_TOP_LIMIT } from '../../helper/constants.js';
import { numberWithCommas } from '../../helper/formatters.js';
import { getMetricsTotals, getTopCommands } from '../../helper/usageTracker.js';
import type { Command } from '../../types/index.js';

interface PeriodInfo {
  sinceUTC: string;
  label: string;
}

const metrics: Command = {
  data: new SlashCommandBuilder()
    .setName('metrics')
    .setDescription('Show command usage metrics')
    .addStringOption((option) =>
      option
        .setName('period')
        .setDescription('Timeframe')
        .addChoices(
          { name: 'Daily', value: 'daily' },
          { name: 'Weekly', value: 'weekly' },
          { name: 'Monthly', value: 'monthly' },
          { name: 'Yearly', value: 'yearly' },
        ),
    ),
  examples: ['/metrics', '/metrics period:weekly'],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const startTime = Date.now();
    await interaction.deferReply();

    const period = interaction.options.getString('period') || 'daily';
    const { sinceUTC, label } = getSince(period);

    try {
      const totals = getMetricsTotals(sinceUTC);
      const top = getTopCommands(sinceUTC, METRICS_TOP_LIMIT);

      const totalCount = totals.total_count;
      const successCount = totals.success_count;
      const failureCount = totals.failure_count;
      const successRate =
        totalCount > 0
          ? Math.round((successCount / totalCount) * 1000) / 10
          : 0;

      const topLines =
        top.length > 0
          ? top
              .map(
                (r, i) =>
                  `${String(i + 1).padStart(2, '0')}. ${r.command_name} — ${numberWithCommas(
                    r.cnt,
                  )}`,
              )
              .join('\n')
          : 'No data yet.';

      const duration = Date.now() - startTime;
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('Command Metrics')
        .setDescription(`Timeframe: ${label}`)
        .addFields(
          {
            name: 'Totals',
            value:
              `Total: ${numberWithCommas(totalCount)}\n` +
              `Success: ${numberWithCommas(successCount)}\n` +
              `Failed: ${numberWithCommas(failureCount)}\n` +
              `Success rate: ${successRate}%`,
            inline: true,
          },
          {
            name: `Top ${METRICS_TOP_LIMIT} Commands`,
            value: topLines,
            inline: false,
          },
        )
        .setFooter({ text: `via tc-bot - ${duration}ms`, iconURL: BOT_ICON_URL })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[METRICS] Failed to query metrics:', err);
      await interaction.editReply('Metrics are currently unavailable.');
    }
  },
};

/**
 * Calculates the start date and label for a given time period.
 */
function getSince(period: string): PeriodInfo {
  const now = new Date();
  const since = new Date(now.getTime());

  let label = 'Daily (last 24h)';
  switch (period) {
    case 'weekly':
      since.setUTCDate(since.getUTCDate() - 7);
      label = 'Weekly (last 7 days)';
      break;
    case 'monthly':
      since.setUTCMonth(since.getUTCMonth() - 1);
      label = 'Monthly (last 30 days)';
      break;
    case 'yearly':
      since.setUTCFullYear(since.getUTCFullYear() - 1);
      label = 'Yearly (last 365 days)';
      break;
    case 'daily':
    default:
      since.setUTCDate(since.getUTCDate() - 1);
      label = 'Daily (last 24h)';
  }

  const sinceUTC = formatUTC(since);
  return { sinceUTC, label };
}

/**
 * Formats a Date object as a UTC timestamp string for database queries.
 */
function formatUTC(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds(),
  )}`;
}

export default metrics;