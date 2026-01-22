import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { buildMopupEmbed } from '../../helper/mopup.js';
import type { Command } from '../../types/index.js';

const mopup: Command = {
  data: new SlashCommandBuilder()
    .setName('mopup')
    .setDescription('Time until next mopup'),
  examples: ['/mopup'],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const startTime = Date.now();
    await interaction.reply({ embeds: [buildMopupEmbed(startTime)] });
  },
};

export default mopup;