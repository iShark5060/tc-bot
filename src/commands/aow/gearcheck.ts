import { EmbedBuilder, SlashCommandBuilder, Colors, type ChatInputCommandInteraction } from 'discord.js';
import { BOT_ICON_URL, GEARCHECK_LEVELS, GEARCHECK_MULTIPLIERS } from '../../helper/constants.js';
import { numberWithCommas } from '../../helper/formatters.js';
import type { Command, GearCalculations } from '../../types/index.js';

const gearcheck: Command = {
  data: new SlashCommandBuilder()
    .setName('gearcheck')
    .setDescription('Calculate stat at base and +10/13/20/30/40/50')
    .addNumberOption((option) =>
      option
        .setName('stat')
        .setDescription('Current stat amount')
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('Current upgrade level')
        .setRequired(true),
    ),
  examples: ['/gearcheck stat:120 level:20', '/gearcheck stat:85.5 level:10'],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const startTime = Date.now();
    await interaction.deferReply();

    const statValue = interaction.options.getNumber('stat');
    const gearLevel = interaction.options.getInteger('level');

    if (!statValue || statValue <= 0) {
      await interaction.editReply({
        content: 'Stat value must be greater than 0',
      });
      return;
    }

    if (gearLevel === null || gearLevel < 0) {
      await interaction.editReply({
        content: 'Gear level cannot be negative',
      });
      return;
    }

    if (gearLevel > 100) {
      await interaction.editReply({
        content: `Gear level ${gearLevel} is unreasonably high (max expected: 100).`,
      });
      return;
    }

    const calculations = calculateGearStats(statValue, gearLevel);
    const embed = createGearEmbed(statValue, gearLevel, calculations, startTime);

    await interaction.editReply({ embeds: [embed] });
  },
};

/**
 * Calculates gear stats at all upgrade levels (0, 10, 13, 20, 30, 40, 50).
 * Derives base stat from current stat and level, then applies multipliers.
 * @param currentStat - Current stat value at the given level
 * @param currentLevel - Current upgrade level (0-100)
 * @returns Object mapping level to calculated stat string (e.g., { 0: "100.00", 10: "200.00" })
 * @example
 * calculateGearStats(120, 20)
 */
function calculateGearStats(
  currentStat: number,
  currentLevel: number,
): GearCalculations {
  const currentMultiplier = 1 + currentLevel / 10;
  const baseStat = currentStat / currentMultiplier;

  return GEARCHECK_LEVELS.reduce(
    (acc, level, index) => {
      acc[level] = (baseStat * GEARCHECK_MULTIPLIERS[index]).toFixed(2);
      return acc;
    },
    {} as GearCalculations,
  );
}

/**
 * Creates a Discord embed displaying gear stat calculations.
 * @param currentStat - The current stat value
 * @param currentLevel - The current gear upgrade level
 * @param calculations - Pre-calculated stats for all upgrade levels
 * @param startTime - Timestamp when command processing started (for footer timing)
 * @returns Configured EmbedBuilder with gear stats
 */
function createGearEmbed(
  currentStat: number,
  currentLevel: number,
  calculations: GearCalculations,
  startTime: number,
): EmbedBuilder {
  const calculatedText = Object.entries(calculations)
    .map(([level, stat]) => `+${level}:: ${numberWithCommas(stat)}%`)
    .join('\n');

  const duration = Date.now() - startTime;
  return new EmbedBuilder()
    .setColor(Colors.White)
    .setTitle('Gearcheck')
    .addFields(
      {
        name: 'Current stat:',
        value:
          '```asciidoc\n' +
          `+${currentLevel}: ${numberWithCommas(currentStat.toFixed(2))}%` +
          '```',
      },
      {
        name: 'Calculated:',
        value: `\`\`\`asciidoc\n${calculatedText}\`\`\``,
      },
    )
    .setFooter({ text: `via tc-bot - ${duration}ms`, iconURL: BOT_ICON_URL });
}

export default gearcheck;
export { calculateGearStats };