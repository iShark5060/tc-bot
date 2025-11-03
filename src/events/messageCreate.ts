import { Events, type Message } from 'discord.js';

import { handleMessageError } from '../helper/errorHandler.js';
import { calculateMopupTiming } from '../helper/mopup.js';
import { logCommandUsage } from '../helper/usageTracker.js';
import type { Event } from '../types/index.js';

const messageCreate: Event = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    if (!shouldProcessMessage(message)) return;

    if (message.content === '!tcmu') {
      try {
        const { status, color, time } = calculateMopupTiming();
        if ('send' in message.channel) {
          await (message.channel as any).send({
            embeds: [
              {
                color,
                title: 'Mopup',
                fields: [
                  { name: 'Status:', value: `\`\`\`asciidoc\n${status}\`\`\`` },
                  {
                    name: 'Time remaining:',
                    value: `\`\`\`asciidoc\n${time}\`\`\``,
                  },
                ],
              },
            ],
          });
        }
        await logCommandUsage({
          commandName: 'msg:!tcmu',
          userId: message.author?.id,
          guildId: message.guildId || null,
          success: true,
        });
      } catch (error) {
        await handleMessageError(message, error);
        try {
          await logCommandUsage({
            commandName: 'msg:!tcmu',
            userId: message.author?.id,
            guildId: message.guildId || null,
            success: false,
            errorMessage: (error as Error)?.message || String(error),
          });
        } catch {
          // ignore logging errors
        }
      }
    }
  },
};

function shouldProcessMessage(message: Message): boolean {
  return (message.channel as any).name === 'tc-autobot' && !message.author.bot;
}

export default messageCreate;
