const {SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands with usage examples'),
  examples: ['/help'],

  async execute(interaction) {
    const commands = interaction.client.commands;

    if (!commands || commands.size === 0) {
    return interaction.reply({
      content: 'No commands are currently available.',
      flags: MessageFlags.Ephemeral,
    });
    }

    const visible = [...commands.values()].filter((cmd) =>
    canSeeCommand(cmd, interaction)
    );

    if (visible.length === 0) {
    return interaction.reply({
      content: 'No commands available for your permissions in this server.',
      flags: MessageFlags.Ephemeral,
    });
    }

    const commandList = visible
    .map((cmd) => {
      let entry = `**/${cmd.data.name}** — ${cmd.data.description}`;
      if (cmd.examples && cmd.examples.length > 0) {
      entry += `\n   _Example:_ ${cmd.examples.join(' | ')}`;
      }
      return entry;
    })
    .join('\n\n');

    const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setTitle('📜 Available Commands')
    .setDescription(commandList.slice(0, 4000))
    .setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

function canSeeCommand(cmd, interaction) {
  const json = typeof cmd.data?.toJSON === 'function' ? cmd.data.toJSON() : {};
  const required = json.default_member_permissions;

  if (!required) return true;
  if (!interaction.guild) return false;

  const requiredBits = BigInt(required);
  const memberPerms =
    interaction.memberPermissions || interaction.member?.permissions;
  if (!memberPerms) return false;

  return memberPerms.has(new PermissionsBitField(requiredBits));
}