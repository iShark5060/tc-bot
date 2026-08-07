import { describe, expect, it } from 'vitest';

import { isExpiredInteractionError, isTransientNetworkError, serializeErrorForLog } from '../src/helper/logError.js';

describe('isTransientNetworkError', () => {
  it('detects undici connect timeout errors by code', () => {
    const error = Object.assign(new Error('Connect Timeout Error (attempted address: discord.com:443)'), {
      name: 'ConnectTimeoutError',
      code: 'UND_ERR_CONNECT_TIMEOUT',
    });

    expect(isTransientNetworkError(error)).toBe(true);
  });

  it('detects connect timeout errors by name', () => {
    const error = new Error('Connect Timeout Error');
    error.name = 'ConnectTimeoutError';

    expect(isTransientNetworkError(error)).toBe(true);
  });

  it('detects common node network error codes', () => {
    const error = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });

    expect(isTransientNetworkError(error)).toBe(true);
  });

  it('ignores non-string error codes', () => {
    const error = Object.assign(new Error('read ECONNRESET'), { code: 12345 });

    expect(isTransientNetworkError(error)).toBe(false);
  });

  it('does not treat unexpected errors as transient', () => {
    const error = new Error('Missing Access');

    expect(isTransientNetworkError(error)).toBe(false);
  });
});

describe('isExpiredInteractionError', () => {
  it('detects Discord unknown interaction (10062)', () => {
    const error = Object.assign(new Error('Unknown interaction'), {
      name: 'DiscordAPIError[10062]',
      code: 10062,
    });

    expect(isExpiredInteractionError(error)).toBe(true);
  });

  it('detects Discord already-acknowledged interaction (40060)', () => {
    const error = Object.assign(new Error('Interaction has already been acknowledged.'), {
      name: 'DiscordAPIError[40060]',
      code: 40060,
    });

    expect(isExpiredInteractionError(error)).toBe(true);
  });

  it('ignores other Discord API errors', () => {
    const error = Object.assign(new Error('Missing Access'), {
      name: 'DiscordAPIError[50013]',
      code: 50013,
    });

    expect(isExpiredInteractionError(error)).toBe(false);
  });
});

describe('serializeErrorForLog', () => {
  it('omits stack traces for transient network errors', () => {
    const error = Object.assign(new Error('Connect Timeout Error (attempted address: discord.com:443)'), {
      name: 'ConnectTimeoutError',
      code: 'UND_ERR_CONNECT_TIMEOUT',
    });
    error.stack = 'ConnectTimeoutError: ...\n    at onConnectTimeout (...)';

    expect(serializeErrorForLog(error)).toEqual({
      name: 'ConnectTimeoutError',
      message: 'Connect Timeout Error (attempted address: discord.com:443)',
      code: 'UND_ERR_CONNECT_TIMEOUT',
      transient: true,
    });
  });

  it('includes stack traces for non-transient errors', () => {
    const error = new Error('Missing Access');
    error.stack = 'Error: Missing Access\n    at setName (...)';

    expect(serializeErrorForLog(error)).toEqual({
      name: 'Error',
      message: 'Missing Access',
      stack: error.stack,
    });
  });

  it('omits stack traces for expired Discord interactions', () => {
    const error = Object.assign(new Error('Unknown interaction'), {
      name: 'DiscordAPIError[10062]',
      code: 10062,
    });
    error.stack = 'DiscordAPIError[10062]: Unknown interaction\n    at handleErrors (...)';

    expect(serializeErrorForLog(error)).toEqual({
      name: 'DiscordAPIError[10062]',
      message: 'Unknown interaction',
      code: 10062,
      transient: true,
    });
  });

  it('returns UnknownError shape for non-Error values', () => {
    const error = 'rate limited';

    expect(serializeErrorForLog(error)).toEqual({
      name: 'UnknownError',
      message: String(error),
    });
  });
});
