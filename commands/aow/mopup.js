import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { calculateMopupTiming } from '../../helper/mopup.js';

export default {
  data: new SlashCommandBuilder()
    .setName('mopup')
    .setDescription('Time until next mopup'),
  examples: ['/mopup'],

  async execute(interaction) {
    const { status, color, time } = calculateMopupTiming();
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('Mopup')
      .addFields(
        { name: 'Status:', value: '```asciidoc\n' + status + '```' },
        { name: 'Time remaining:', value: '```asciidoc\n' + time + '```' },
      );
    await interaction.reply({ embeds: [embed] });
  },
};
