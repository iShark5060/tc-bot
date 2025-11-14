import type { DiscordNotificationParams } from '../types/index.js';

const fetch = global.fetch;

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
    startup: 0x2ecc71,
    shutdown: 0xf39c12,
    error: 0xcf142b,
    info: 0x3498db,
  };

  const title = defaultTitles[type] || type;
  const color = colors[type] || colors.info;

  let description = message || '';
  if (error) {
    const errorText =
      typeof error === 'string'
        ? error
        : (error as Error)?.stack || (error as Error)?.message || JSON.stringify(error);
    description += `\n\`\`\`\n${String(errorText).slice(0, 1800)}\n\`\`\``;
  }
  if (mention) description = `@here\n${description}`;

  try {
    const response = await fetch(`${WEBHOOK_BASE}/${id}/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'TC-Bot Notifications',
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
