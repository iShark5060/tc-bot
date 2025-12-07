import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { calculateMopupTiming } from '../../helper/mopup.js';
import type { Command } from '../../types/index.js';

const mopup: Command = {
  data: new SlashCommandBuilder()
    .setName('mopup')
    .setDescription('Time until next mopup'),
  examples: ['/mopup'],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const { status, color, time } = calculateMopupTiming();
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('Mopup')
      .addFields(
        { name: 'Status:', value: `\`\`\`asciidoc\n${status}\`\`\`` },
        { name: 'Time remaining:', value: `\`\`\`asciidoc\n${time}\`\`\`` },
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default mopup;