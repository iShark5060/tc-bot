/**
 * PM2 metrics for monitoring bot performance and health.
 * These metrics are exposed via PM2 Plus dashboard.
 * @module metrics
 */
import io from '@pm2/io';

/** Counter for total commands executed since startup */
export const commandsCounter = io.counter({
  name: 'Total Commands',
  id: 'app/commands/total',
});

/** Meter tracking commands per second rate */
export const commandsPerSecond = io.meter({
  name: 'Commands/Second',
  id: 'app/commands/rate',
});

/** Counter for command execution errors */
export const commandErrors = io.counter({
  name: 'Command Errors',
  id: 'app/commands/errors',
});

/** Gauge showing current Discord WebSocket latency */
export const discordLatency = io.metric({
  name: 'Discord API Latency (ms)',
  id: 'app/discord/latency',
  unit: 'ms',
});

/** Gauge showing number of cached Google Sheet entries */
export const cachedSheetRows = io.metric({
  name: 'Google Sheet Cache Size',
  id: 'app/cache/sheet-rows',
});

/** Counter for Google Sheet cache hits */
export const googleSheetCacheHits = io.counter({
  name: 'Google Sheet Cache Hits',
  id: 'app/cache/hits',
});

/** Counter for Google Sheet cache misses */
export const googleSheetCacheMisses = io.counter({
  name: 'Google Sheet Cache Misses',
  id: 'app/cache/misses',
});