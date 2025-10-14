const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const { numberWithCommas } = require('../../helper/formatters.js');

const DB_PATH = process.env.SQLITE_DB_PATH || './data/metrics.db';
const TOP_LIMIT = 10;

module.exports = {
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
          { name: 'Yearly', value: 'yearly' }
        )
    ),
  examples: ['/metrics', '/metrics period:weekly'],

  async execute(interaction) {
    await interaction.deferReply();

    const period = interaction.options.getString('period') || 'daily';
    const { sinceUTC, label } = getSince(period);

    try {
      const db = new Database(DB_PATH, {
        readonly: true,
        fileMustExist: true,
      });

      const totalsStmt = db.prepare(
        `
        SELECT
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success_count,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failure_count,
          COUNT(*) AS total_count
        FROM command_usage
        WHERE created_at >= ?
        `
      );

      const topStmt = db.prepare(
        `
        SELECT command_name, COUNT(*) AS cnt
        FROM command_usage
        WHERE created_at >= ?
        GROUP BY command_name
        ORDER BY cnt DESC, command_name ASC
        LIMIT ?
        `
      );

      const totals = totalsStmt.get(sinceUTC);
      const top = topStmt.all(sinceUTC, TOP_LIMIT);

      const totalCount = Number(totals?.total_count || 0);
      const successCount = Number(totals?.success_count || 0);
      const failureCount = Number(totals?.failure_count || 0);
      const successRate =
        totalCount > 0 ? Math.round((successCount / totalCount) * 1000) / 10 : 0;

      const topLines =
        top.length > 0
          ? top
              .map(
                (r, i) =>
                  `${String(i + 1).padStart(2, '0')}. ${r.command_name} — ${numberWithCommas(
                    r.cnt
                  )}`
              )
              .join('\n')
          : 'No data yet.';

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
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
            name: `Top ${TOP_LIMIT} Commands`,
            value: topLines,
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      db.close();
    } catch (err) {
      console.error('[METRICS] Failed to query metrics:', err);
      await interaction.editReply('Metrics are currently unavailable.');
    }
  },
};

function getSince(period) {
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

function formatUTC(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    '-' +
    pad(d.getUTCMonth() + 1) +
    '-' +
    pad(d.getUTCDate()) +
    ' ' +
    pad(d.getUTCHours()) +
    ':' +
    pad(d.getUTCMinutes()) +
    ':' +
    pad(d.getUTCSeconds())
  );
}