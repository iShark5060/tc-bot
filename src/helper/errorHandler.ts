import { MessageFlags, type Message, type RepliableInteraction } from 'discord.js';

import { isExpiredInteractionError } from './logError.js';
import {
  safeInteractionFollowUp,
  safeInteractionReply,
  safeMessageReply,
} from './safeDiscordResponse.js';

async function handleCommandError(
  interaction: RepliableInteraction,
  error: unknown,
): Promise<void> {
  if (isExpiredInteractionError(error)) {
    // Token already dead — another reply/followUp will only produce more 10062 noise.
    console.warn('[ERROR] Command failed after interaction expired:', error);
    return;
  }

  console.error('[ERROR] Command execution failed:', error);

  const errorMessage = {
    content: 'There was an error while executing this command!',
    flags: MessageFlags.Ephemeral,
  } as const;

  try {
    if (interaction.replied || interaction.deferred) {
      await safeInteractionFollowUp(interaction, errorMessage);
    } else {
      await safeInteractionReply(interaction, errorMessage);
    }
  } catch (followUpError) {
    if (isExpiredInteractionError(followUpError)) {
      console.warn('[ERROR] Failed to send error message: interaction expired');
      return;
    }
    console.error('[ERROR] Failed to send error message:', followUpError);
  }
}

async function handleMessageError(message: Message, error: unknown): Promise<void> {
  console.error('[ERROR] Message command execution failed:', error);

  try {
    await safeMessageReply(message, 'There was an error while executing this command!');
  } catch (replyError) {
    console.error('[ERROR] Failed to send error message:', replyError);
  }
}

export { handleCommandError, handleMessageError };
