const TRANSIENT_ERROR_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_ABORTED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

const TRANSIENT_ERROR_NAMES = new Set([
  'ConnectTimeoutError',
  'HeadersTimeoutError',
  'BodyTimeoutError',
  'SocketError',
  'AbortError',
]);

const DISCORD_UNKNOWN_INTERACTION = 10062;
const DISCORD_INTERACTION_ALREADY_ACKNOWLEDGED = 40060;

interface SerializedLogError {
  name: string;
  message: string;
  code?: string | number;
  transient?: true;
  stack?: string;
}

function getErrorCode(error: Error): string | number | undefined {
  if (!('code' in error)) {
    return undefined;
  }
  const { code } = error as { code: unknown };
  if (typeof code === 'string' || typeof code === 'number') {
    return code;
  }
  return undefined;
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = getErrorCode(error);
  if (typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code)) {
    return true;
  }

  return TRANSIENT_ERROR_NAMES.has(error.name);
}

function isExpiredInteractionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = getErrorCode(error);
  return code === DISCORD_UNKNOWN_INTERACTION || code === DISCORD_INTERACTION_ALREADY_ACKNOWLEDGED;
}

function serializeErrorForLog(error: unknown): SerializedLogError {
  if (!(error instanceof Error)) {
    return { name: 'UnknownError', message: String(error) };
  }

  const code = getErrorCode(error);
  const serialized: SerializedLogError = {
    name: error.name,
    message: error.message,
  };

  if (code !== undefined) {
    serialized.code = code;
  }

  if (isTransientNetworkError(error) || isExpiredInteractionError(error)) {
    serialized.transient = true;
    return serialized;
  }

  if (error.stack) {
    serialized.stack = error.stack;
  }

  return serialized;
}

export {
  isExpiredInteractionError,
  isTransientNetworkError,
  serializeErrorForLog,
  type SerializedLogError,
};
