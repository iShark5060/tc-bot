import { RESTEvents, type APIRequest, type ResponseLike } from 'discord.js';

import type { ExtendedClient } from '../types/index.js';
import { debugLogger } from './debugLogger.js';

/**
 * Logs a WARN whenever @discordjs/rest retries a request (timeouts, 5xx, connection errors).
 * PM2 (e.g. pm2-discord) can forward WARN lines to Discord.
 */
export function attachRestRetryNotifier(client: ExtendedClient): void {
  client.rest.on(RESTEvents.Response, (request: APIRequest, response: ResponseLike) => {
    if (request.retries <= 0) {
      return;
    }

    debugLogger.warn('REST', 'API request completed after REST-layer retries', {
      method: request.method,
      path: String(request.path),
      route: request.route,
      retries: request.retries,
      status: response.status,
      statusText: response.statusText,
      responseOk: response.ok,
      processId: process.pid,
    });
  });
}
