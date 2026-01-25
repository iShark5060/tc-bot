import { Events, type Client } from 'discord.js';

import { debugLogger } from '../helper/debugLogger.js';
import { discordLatency } from '../helper/metrics.js';
import type { Event, ExtendedClient } from '../types/index.js';

let latencyTimer: NodeJS.Timeout | null = null;

const clientReady: Event = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client): void {
    debugLogger.event(Events.ClientReady, 'Client ready event fired');
    debugLogger.boot('Bot is ready and connected to Discord', {
      tag: client.user?.tag,
      id: client.user?.id,
      username: client.user?.username,
    });

    console.log(`[BOOT] Bot ready: ${client.user?.tag}`);

    const guilds = client.guilds.cache.size;
    const users = client.users.cache.size;
    const commands = (client as ExtendedClient).commands.size;

    debugLogger.boot('Bot statistics', {
      guilds,
      users,
      commands,
      channels: client.channels.cache.size,
    });

    console.log(`[BOOT] Guilds: ${guilds}`);
    console.log(`[BOOT] Users: ${users}`);
    console.log(`[BOOT] Commands: ${commands}`);

    debugLogger.step('METRICS', 'Starting Discord latency monitoring (30s interval)');
    latencyTimer = setInterval(() => {
      const latency = Math.round(client.ws.ping);
      discordLatency.set(latency);
      debugLogger.debug('METRICS', 'Discord latency updated', { latency: `${latency}ms` });
    }, 30000);
  },
};

export function stopLatencyMonitoring(): void {
  if (latencyTimer) {
    clearInterval(latencyTimer);
    latencyTimer = null;
    debugLogger.step('METRICS', 'Discord latency monitoring stopped');
  }
}

export default clientReady;