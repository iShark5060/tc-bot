import { MessageFlags, type Message, type RepliableInteraction } from 'discord.js';

/**
 * Handles errors during slash command execution.
 * Sends an ephemeral error message to the user via reply or followUp.
 * @param interaction - The interaction that caused the error
 * @param error - The error that occurred
 */
async function handleCommandError(
  interaction: RepliableInteraction,
  error: unknown,
): Promise<void> {
  console.error('[ERROR] Command execution failed:', error);

  const errorMessage = {
    content: 'There was an error while executing this command!',
    flags: MessageFlags.Ephemeral,
  } as const;

  try {
    if ('isRepliable' in interaction && interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  } catch (followUpError) {
    console.error('[ERROR] Failed to send error message:', followUpError);
  }
}

/**
 * Handles errors during message-based command execution.
 * Sends a reply to the original message with error notification.
 * @param message - The message that triggered the command
 * @param error - The error that occurred
 */
async function handleMessageError(message: Message, error: unknown): Promise<void> {
  console.error('[ERROR] Message command execution failed:', error);

  try {
    await message.reply('There was an error while executing this command!');
  } catch (replyError) {
    console.error('[ERROR] Failed to send error message:', replyError);
  }
}

export { handleCommandError, handleMessageError };