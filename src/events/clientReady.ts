import { Events, type Client } from 'discord.js';

import { discordLatency } from '../helper/metrics.js';
import type { Event } from '../types/index.js';

const clientReady: Event = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    console.log(`[BOOT] Bot ready: ${client.user?.tag}`);
    console.log(`[BOOT] Guilds: ${client.guilds.cache.size}`);
    console.log(`[BOOT] Users: ${client.users.cache.size}`);
    console.log(`[BOOT] Commands: ${(client as any).commands.size}`);

    // Update Discord latency every 30 seconds
    setInterval(() => {
      discordLatency.set(Math.round(client.ws.ping));
    }, 30000);
  },
};

export default clientReady;
