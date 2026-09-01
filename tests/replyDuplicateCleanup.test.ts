import { describe, expect, it, vi } from 'vitest';

import { dedupeBotResponse, messageMatchesScope } from '../src/helper/replyDuplicateCleanup.js';

describe('messageMatchesScope', () => {
  it('scopes interaction replies by interaction id', () => {
    const message = {
      interaction: { id: 'interaction-1' },
      reference: null,
    };

    expect(messageMatchesScope(message as never, { type: 'interaction', interactionId: 'interaction-1' })).toBe(true);
    expect(messageMatchesScope(message as never, { type: 'interaction', interactionId: 'interaction-2' })).toBe(false);
  });

  it('scopes message replies by parent message id', () => {
    const message = {
      interaction: null,
      reference: { messageId: 'parent-1' },
    };

    expect(messageMatchesScope(message as never, { type: 'reply', parentMessageId: 'parent-1' })).toBe(true);
    expect(messageMatchesScope(message as never, { type: 'reply', parentMessageId: 'parent-2' })).toBe(false);
  });

  it('scopes channel announcements to non-interaction, non-reply messages', () => {
    const announcement = { interaction: null, reference: null };
    const slashReply = { interaction: { id: 'interaction-1' }, reference: null };

    expect(messageMatchesScope(announcement as never, { type: 'announce', key: 'mopup' })).toBe(true);
    expect(messageMatchesScope(slashReply as never, { type: 'announce', key: 'mopup' })).toBe(false);
  });
});

describe('dedupeBotResponse', () => {
  it('skips cleanup when channel fetch fails', async () => {
    const fetchChannel = vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error('Unknown Channel'));
    const sentMessage = {
      id: 'msg-1',
      channel: null,
      channelId: 'channel-1',
      client: {
        user: { id: 'bot-1' },
        channels: { fetch: fetchChannel },
      },
    };

    await expect(
      dedupeBotResponse(sentMessage as never, { type: 'interaction', interactionId: 'i-1' }),
    ).resolves.toBeUndefined();
    expect(fetchChannel).toHaveBeenCalledWith('channel-1');
  });

  it('fetches the channel when the message channel is missing', async () => {
    const fetchMessages = vi.fn<() => Promise<Map<string, unknown>>>().mockResolvedValue(new Map());
    const fetchChannel = vi.fn<() => Promise<unknown>>().mockResolvedValue({
      id: 'channel-1',
      isTextBased: () => true,
      messages: { fetch: fetchMessages },
    });
    const sentMessage = {
      id: 'msg-1',
      content: '',
      embeds: [],
      channel: null,
      channelId: 'channel-1',
      client: {
        user: { id: 'bot-1' },
        channels: { fetch: fetchChannel },
      },
    };

    await dedupeBotResponse(sentMessage as never, { type: 'interaction', interactionId: 'i-1' });

    expect(fetchChannel).toHaveBeenCalledWith('channel-1');
    expect(fetchMessages).toHaveBeenCalledOnce();
  });

  it('does not fetch when the message already has a text channel', async () => {
    const fetchMessages = vi.fn<() => Promise<Map<string, unknown>>>().mockResolvedValue(new Map());
    const fetchChannel = vi.fn<() => Promise<unknown>>();
    const sentMessage = {
      id: 'msg-1',
      content: '',
      embeds: [],
      channel: {
        id: 'channel-1',
        isTextBased: () => true,
        messages: { fetch: fetchMessages },
      },
      channelId: 'channel-1',
      client: {
        user: { id: 'bot-1' },
        channels: { fetch: fetchChannel },
      },
    };

    await dedupeBotResponse(sentMessage as never, { type: 'interaction', interactionId: 'i-1' });

    expect(fetchChannel).not.toHaveBeenCalled();
    expect(fetchMessages).toHaveBeenCalledOnce();
  });
});
