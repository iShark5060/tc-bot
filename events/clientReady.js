import { Events } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[BOOT] Bot ready: ${client.user.tag}`);
    console.log(`[BOOT] Guilds: ${client.guilds.cache.size}`);
    console.log(`[BOOT] Users: ${client.users.cache.size}`);
    console.log(`[BOOT] Commands: ${client.commands.size}`);
  },
};