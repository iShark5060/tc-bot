import type { Message } from 'discord.js';

import { debugLogger } from './debugLogger.js';

const REPLY_DUPLICATE_SCAN_LIMIT = 25;

export async function removeDuplicateRepliesToMessage(
  parentMessage: Message,
  sentMessage: Message,
): Promise<void> {
  const channel = parentMessage.channel;
  if (!channel.isTextBased()) return;
  const botUserId = parentMessage.client.user?.id;
  if (!botUserId) return;

  const targetFingerprint = messageReplyFingerprint(sentMessage);

  try {
    const recentMessages = await channel.messages.fetch({
      limit: REPLY_DUPLICATE_SCAN_LIMIT,
    });
    const matchingReplies = [...recentMessages.values()].filter((candidate) => {
      if (candidate.author.id !== botUserId) return false;
      if (candidate.reference?.messageId !== parentMessage.id) return false;
      return messageReplyFingerprint(candidate) === targetFingerprint;
    });

    if (matchingReplies.length <= 1) return;

    const sortedByTime = matchingReplies.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const keepMessage =
      sortedByTime.find((candidate) => candidate.id === sentMessage.id) ?? sortedByTime[0];
    const duplicatesToDelete = sortedByTime.filter((candidate) => candidate.id !== keepMessage.id);

    await Promise.allSettled(duplicatesToDelete.map((candidate) => candidate.delete()));
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    debugLogger.error('replyDuplicateCleanup', 'removeDuplicateRepliesToMessage failed', {
      error: err,
      parentMessageId: parentMessage.id,
      channelId: parentMessage.channelId,
      sentMessageId: sentMessage.id,
    });
  }
}

function messageReplyFingerprint(message: Message): string {
  return JSON.stringify({
    content: message.content,
    embeds: message.embeds.map((e) => ({
      title: e.title,
      description: e.description,
      url: e.url,
      color: e.color,
      footer: e.footer ? { text: e.footer.text, iconURL: e.footer.iconURL } : undefined,
      fields: e.fields?.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
    })),
  });
}
