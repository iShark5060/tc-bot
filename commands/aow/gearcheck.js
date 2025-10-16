const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require('discord.js');
const { numberWithCommas } = require('../../helper/formatters.js');

const LEVELS = [0, 10, 13, 20, 30, 40, 50];
const MULTIPLIERS = [1, 2, 2.3, 3, 4, 5, 6];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gearcheck')
    .setDescription('Calculate stat at base and +10/13/20/30/40/50')
    .addNumberOption((option) =>
      option
        .setName('stat')
        .setDescription('Current stat amount')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('Current upgrade level')
        .setRequired(true)
    ),
  examples: [
    '/gearcheck stat:120 level:20',
    '/gearcheck stat:85.5 level:10',
  ],

  async execute(interaction) {
    await interaction.deferReply();

    const statValue = interaction.options.getNumber('stat');
    const gearLevel = interaction.options.getInteger('level');

    // Validate stat value
    if (statValue <= 0) {
      return interaction.editReply({
        content: 'Stat value must be greater than 0',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Validate gear level is reasonable
    if (gearLevel < 0) {
      return interaction.editReply({
        content: 'Gear level cannot be negative',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (gearLevel > 100) {
      return interaction.editReply({
        content: `Gear level ${gearLevel} is unreasonably high (max expected: 100).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const calculations = calculateGearStats(statValue, gearLevel);
    const embed = createGearEmbed(statValue, gearLevel, calculations);

    await interaction.editReply({ embeds: [embed] });
  },
};

function calculateGearStats(currentStat, currentLevel) {
  const currentMultiplier = 1 + currentLevel / 10;
  const baseStat = currentStat / currentMultiplier;
  
  return LEVELS.reduce((acc, level, index) => {
    acc[level] = (baseStat * MULTIPLIERS[index]).toFixed(2);
    return acc;
  }, {});
}

function createGearEmbed(currentStat, currentLevel, calculations) {
  const calculatedText = Object.entries(calculations)
    .map(([level, stat]) => `+${level}:: ${numberWithCommas(stat)}%`)
    .join('\n');

  return new EmbedBuilder()
    .setColor(0xffffff)
    .setTitle('Gearcheck')
    .addFields(
      {
        name: 'Current stat:',
        value: `\`\`\`asciidoc\n+${currentLevel}: ${numberWithCommas(
          currentStat.toFixed(2)
        )}%\`\`\``,
      },
      {
        name: 'Calculated:',
        value: `\`\`\`asciidoc\n${calculatedText}\`\`\``,
      }
    );
}