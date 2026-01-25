/** Log severity levels for categorizing messages */
type LogLevel = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'STEP';

/** Context object for structured logging metadata */
interface LogContext {
  [key: string]: unknown;
}

/**
 * Debug logger class for structured, conditional logging.
 * Logs are enabled via DEBUG=true environment variable.
 * ERROR and WARN levels always output regardless of DEBUG setting.
 */
class DebugLogger {
  private initialized = false;

  private get enabled(): boolean {
    const isEnabled = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

    if (!this.initialized) {
      this.initialized = true;
      if (isEnabled) {
        console.log('[DEBUG] Debug logging enabled');
      }
    }

    return isEnabled;
  }

  private serializeContext(context: LogContext): string {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      if (value instanceof Error) {
        serialized[key] = {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      } else {
        serialized[key] = value;
      }
    }

    return JSON.stringify(serialized);
  }

  private formatMessage(level: LogLevel, category: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${this.serializeContext(context)}` : '';
    return `[${timestamp}] [${level}] [${category}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, category: string, message: string, context?: LogContext): void {
    if (!this.enabled && level !== 'ERROR' && level !== 'WARN') {
      return;
    }

    const formattedMessage = this.formatMessage(level, category, message, context);

    switch (level) {
      case 'ERROR':
        console.error(formattedMessage);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  /** Logs an informational message (requires DEBUG=true) */
  info(category: string, message: string, context?: LogContext): void {
    this.log('INFO', category, message, context);
  }

  /** Logs a debug message (requires DEBUG=true) */
  debug(category: string, message: string, context?: LogContext): void {
    this.log('DEBUG', category, message, context);
  }

  /** Logs a step/progress message (requires DEBUG=true) */
  step(category: string, message: string, context?: LogContext): void {
    this.log('STEP', category, message, context);
  }

  /** Logs a warning message (always outputs) */
  warn(category: string, message: string, context?: LogContext): void {
    this.log('WARN', category, message, context);
  }

  /** Logs an error message (always outputs) */
  error(category: string, message: string, context?: LogContext): void {
    this.log('ERROR', category, message, context);
  }

  /** Logs a command-related debug message */
  command(commandName: string, action: string, context?: LogContext): void {
    this.debug('COMMAND', `[${commandName}] ${action}`, context);
  }

  /** Logs an event-related debug message */
  event(eventName: string, action: string, context?: LogContext): void {
    this.debug('EVENT', `[${eventName}] ${action}`, context);
  }

  /** Logs a boot/startup step message */
  boot(action: string, context?: LogContext): void {
    this.step('BOOT', action, context);
  }

  /** Returns whether debug logging is currently enabled */
  isEnabled(): boolean {
    return this.enabled;
  }
}

export const debugLogger = new DebugLogger();