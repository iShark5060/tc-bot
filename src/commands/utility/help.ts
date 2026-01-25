import { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField, Colors, type ChatInputCommandInteraction } from 'discord.js';

import { BOT_ICON_URL } from '../../helper/constants.js';
import type { Command, ExtendedClient } from '../../types/index.js';

/**
 * Help command.
 * Lists all available commands with descriptions and usage examples.
 * Filters commands based on user permissions.
 */
const help: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands with usage examples'),
  examples: ['/help'],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const startTime = Date.now();
    const commands = (interaction.client as ExtendedClient).commands;

    if (!commands || commands.size === 0) {
      await interaction.reply({
        content: 'No commands are currently available.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const visible = [...commands.values()].filter((cmd) =>
      canSeeCommand(cmd, interaction),
    );

    if (visible.length === 0) {
      await interaction.reply({
        content: 'No commands available for your permissions in this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
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

    const duration = Date.now() - startTime;
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('📜 Available Commands')
      .setDescription(commandList.slice(0, 4000))
      .setFooter({
        text: `via tc-bot - ${duration}ms`,
        iconURL: BOT_ICON_URL,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};

/**
 * Checks if a user has permission to see a command based on required permissions.
 */
function canSeeCommand(cmd: Command, interaction: ChatInputCommandInteraction): boolean {
  const json = typeof cmd.data?.toJSON === 'function' ? cmd.data.toJSON() : {};
  const required = (json as { default_member_permissions?: string })
    .default_member_permissions;

  if (!required) return true;
  if (!interaction.guild) return false;

  const requiredBits = BigInt(required);
  const memberPerms =
    interaction.memberPermissions ?? interaction.member?.permissions;
  if (!memberPerms) return false;

  if (typeof memberPerms === 'string') return false;
  return memberPerms.has(new PermissionsBitField(requiredBits));
}

export default help;