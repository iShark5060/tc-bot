import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

import { numberWithCommas } from '../../helper/formatters.js';
import type { Command, GearCalculations } from '../../types/index.js';

const LEVELS = [0, 10, 13, 20, 30, 40, 50];
const MULTIPLIERS = [1, 2, 2.3, 3, 4, 5, 6];

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
    const embed = createGearEmbed(statValue, gearLevel, calculations);

    await interaction.editReply({ embeds: [embed] });
  },
};

function calculateGearStats(
  currentStat: number,
  currentLevel: number,
): GearCalculations {
  const currentMultiplier = 1 + currentLevel / 10;
  const baseStat = currentStat / currentMultiplier;

  return LEVELS.reduce(
    (acc, level, index) => {
      acc[level] = (baseStat * MULTIPLIERS[index]).toFixed(2);
      return acc;
    },
    {} as GearCalculations,
  );
}

function createGearEmbed(
  currentStat: number,
  currentLevel: number,
  calculations: GearCalculations,
): EmbedBuilder {
  const calculatedText = Object.entries(calculations)
    .map(([level, stat]) => `+${level}:: ${numberWithCommas(stat)}%`)
    .join('\n');

  return new EmbedBuilder()
    .setColor(0xffffff)
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
    );
}

export default gearcheck;