import io from '@pm2/io';

export const commandsCounter = io.counter({
  name: 'Total Commands',
  id: 'app/commands/total',
});

export const commandsPerSecond = io.meter({
  name: 'Commands/Second',
  id: 'app/commands/rate',
});

export const commandErrors = io.counter({
  name: 'Command Errors',
  id: 'app/commands/errors',
});

export const discordLatency = io.metric({
  name: 'Discord API Latency (ms)',
  id: 'app/discord/latency',
  unit: 'ms',
});

export const cachedSheetRows = io.metric({
  name: 'Google Sheet Cache Size',
  id: 'app/cache/sheet-rows',
});

export const googleSheetCacheHits = io.counter({
  name: 'Google Sheet Cache Hits',
  id: 'app/cache/hits',
});

export const googleSheetCacheMisses = io.counter({
  name: 'Google Sheet Cache Misses',
  id: 'app/cache/misses',
});