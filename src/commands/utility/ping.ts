import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

import type { Command } from '../../types/index.js';

/**
 * Ping command.
 * Responds with "Pong!" and displays bot and API latency.
 */
const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong as well as latency.'),
  examples: ['/ping'],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply('Pong!');
    await interaction.editReply(
      `Pong! Latency is ${Date.now() - interaction.createdTimestamp}ms. ` +
        `API latency is ${Math.round(interaction.client.ws.ping)}ms`,
    );
  },
};

export default ping;