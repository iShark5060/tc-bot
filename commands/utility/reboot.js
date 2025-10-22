import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';

export default {
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

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (interaction.guildId !== process.env.GUILD_ID) {
      return interaction.reply({
        content: 'Permission denied. Command used on wrong server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const confirm = interaction.options.getBoolean('confirm');
    if (!confirm) {
      return interaction.reply({
        content:
          '⚠️ Reboot cancelled. You must confirm by setting `confirm:true`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      content: 'Bot is shutting down...',
      flags: MessageFlags.Ephemeral,
    });

    console.log(
      `[REBOOT] Command issued by ${interaction.user.tag} in ${interaction.guild.name}`,
    );

    setTimeout(() => (process.exitCode = 0), 500);
    return Promise.resolve();
  },
};
