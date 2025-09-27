const { Events } = require('discord.js');
const { handleMessageError } = require('../helper/errorHandler.js');
const { calculateMopupTiming } = require('../helper/mopup.js');
const { logCommandUsage } = require('../helper/usageTracker.js');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!shouldProcessMessage(message)) return;

    if (message.content === '!tcmu') {
      try {
        const { status, color, time } = calculateMopupTiming();
        await message.channel.send({
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
            errorMessage: error?.message || String(error),
          });
        } catch (_) {
        }
      }
    }
  },
};

function shouldProcessMessage(message) {
  return message.channel.name === 'tc-autobot' && !message.author.bot;
}