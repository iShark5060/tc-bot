import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../types/index.js';

const reboot: Command = {
  data: new SlashCommandBuilder()
    .setName('reboot')
    .setDescription(
      'Shuts down the bot. PM2 will restart the container automatically.',
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption((option) =>
      option
        .setName('confirm')
        .setDescription('Confirm you want to reboot the bot')
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.guildId !== process.env.GUILD_ID) {
      await interaction.reply({
        content: 'Permission denied. Command used on wrong server.',
        ephemeral: true,
      });
      return;
    }

    const confirm = interaction.options.getBoolean('confirm');
    if (!confirm) {
      await interaction.reply({
        content:
          'Reboot cancelled. You must confirm by setting `confirm:true`.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: 'Bot is shutting down...',
      ephemeral: true,
    });

    console.log(
      `[REBOOT] Command issued by ${interaction.user.tag} in ${interaction.guild.name}`,
    );

    setTimeout(() => process.emit('SIGTERM'), 500);
  },
};

export default reboot;