import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong as well as latency.'),
  examples: ['/ping'],

  async execute(interaction) {
    await interaction.reply('Pong!');
    await interaction.editReply(
      `Pong! Latency is ${Date.now() - interaction.createdTimestamp}ms. ` +
        `API latency is ${Math.round(interaction.client.ws.ping)}ms`,
    );
  },
};