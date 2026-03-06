import { Colors } from 'discord.js';

import type { DiscordNotificationParams } from '../types/index.js';

const WEBHOOK_BASE = 'https://discord.com/api/webhooks';

export async function notifyDiscord({
  type,
  message = '',
  error,
  mention = false,
}: DiscordNotificationParams): Promise<void> {
  const id = process.env.WEBHOOK_ID;
  const token = process.env.WEBHOOK_TOKEN;

  if (!id || !token) {
    console.warn(`[NOTIFY] Skipped (${type}): missing webhook credentials`);
    return;
  }

  const defaultTitles: Record<string, string> = {
    startup: 'TC-Bot Started',
    shutdown: 'TC-Bot Shutting Down',
    error: 'TC-Bot Error',
  };

  const colors: Record<string, number> = {
    startup: Colors.Green,
    shutdown: Colors.Yellow,
    error: Colors.Red,
    info: Colors.Blue,
  };

  const title = defaultTitles[type] || type;
  const color = colors[type] || colors.info;

  let description = message || '';
  if (error) {
    const err = error as Error;
    const errorText =
      typeof error === 'string'
        ? error
        : err?.stack || err?.message || JSON.stringify(error);
    description += `\n\`\`\`\n${String(errorText).slice(0, 1800)}\n\`\`\``;
  }
  const content = mention ? '@here' : undefined;

  try {
    const response = await fetch(`${WEBHOOK_BASE}/${id}/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'TC-Bot Notifications',
        content,
        allowed_mentions: mention
          ? {
              parse: ['everyone'],
            }
          : undefined,
        embeds: [
          {
            title,
            description: description || 'No details provided.',
            color,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(`[NOTIFY] Webhook returned ${response.status}`);
    } else {
      console.log(`[NOTIFY] Sent ${type} notification`);
    }
  } catch (err) {
    console.error(`[NOTIFY] Failed to send ${type} notification:`, err);
  }
}
