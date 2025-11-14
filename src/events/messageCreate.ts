import { Events, type Message } from 'discord.js';

import { handleMessageError } from '../helper/errorHandler.js';
import { debugLogger } from '../helper/debugLogger.js';
import { calculateMopupTiming } from '../helper/mopup.js';
import { logCommandUsage } from '../helper/usageTracker.js';
import type { Event } from '../types/index.js';

const messageCreate: Event = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    debugLogger.event(Events.MessageCreate, 'Message received', {
      messageId: message.id,
      authorId: message.author?.id,
      author: message.author?.username,
      channelId: message.channelId,
      channelName: (message.channel as any).name,
      content: message.content.substring(0, 100), // Log first 100 chars
      isBot: message.author?.bot,
    });

    if (!shouldProcessMessage(message)) {
      debugLogger.debug('MESSAGE', 'Message filtered out (not processing)', {
        channelName: (message.channel as any).name,
        isBot: message.author?.bot,
      });
      return;
    }

    debugLogger.debug('MESSAGE', 'Message passed filter, checking for commands', {
      content: message.content,
    });

    if (message.content === '!tcmu') {
      debugLogger.command('msg:!tcmu', 'Message command execution started', {
        userId: message.author?.id,
        username: message.author?.username,
        guildId: message.guildId,
        channelId: message.channelId,
      });

      const startTime = Date.now();
      try {
        debugLogger.step('COMMAND', 'Calculating mopup timing for !tcmu');
        const { status, color, time } = calculateMopupTiming();
        debugLogger.debug('COMMAND', 'Mopup timing calculated', { status, time });

        if ('send' in message.channel) {
          debugLogger.step('COMMAND', 'Sending mopup embed response');
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
          debugLogger.step('COMMAND', 'Mopup embed sent successfully');
        } else {
          debugLogger.warn('COMMAND', 'Channel does not support sending messages');
        }

        const duration = Date.now() - startTime;
        debugLogger.command('msg:!tcmu', 'Command executed successfully', {
          duration: `${duration}ms`,
        });

        debugLogger.debug('COMMAND', 'Logging command usage', { commandName: 'msg:!tcmu' });
        await logCommandUsage({
          commandName: 'msg:!tcmu',
          userId: message.author?.id,
          guildId: message.guildId || null,
          success: true,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        debugLogger.error('COMMAND', 'Message command execution failed', {
          commandName: 'msg:!tcmu',
          duration: `${duration}ms`,
          error: error as Error,
        });

        await handleMessageError(message, error);
        try {
          await logCommandUsage({
            commandName: 'msg:!tcmu',
            userId: message.author?.id,
            guildId: message.guildId || null,
            success: false,
            errorMessage: (error as Error)?.message || String(error),
          });
        } catch (logError) {
          debugLogger.error('COMMAND', 'Failed to log command usage', {
            commandName: 'msg:!tcmu',
            error: logError as Error,
          });
          // ignore logging errors
        }
      }
    } else {
      debugLogger.debug('MESSAGE', 'Message does not match any command pattern', {
        content: message.content,
      });
    }
  },
};

function shouldProcessMessage(message: Message): boolean {
  return (message.channel as any).name === 'tc-autobot' && !message.author.bot;
}

export default messageCreate;
