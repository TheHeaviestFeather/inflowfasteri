/**
 * Production-safe logging utility
 * Only logs in development mode to prevent console pollution in production
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// In production, only log warnings and errors
const MIN_LEVEL: LogLevel = import.meta.env.DEV ? "debug" : "warn";

/**
 * Create a namespaced logger instance
 */
export function createLogger(namespace: string) {
  const formatMessage = (level: LogLevel, message: string, context?: LogContext) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${namespace}] [${level.toUpperCase()}]`;
    return { prefix, message, context };
  };

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
  };

  return {
    debug(message: string, context?: LogContext) {
      if (shouldLog("debug")) {
        const { prefix } = formatMessage("debug", message, context);
        console.log(`${prefix} ${message}`, context || "");
      }
    },

    info(message: string, context?: LogContext) {
      if (shouldLog("info")) {
        const { prefix } = formatMessage("info", message, context);
        console.info(`${prefix} ${message}`, context || "");
      }
    },

    warn(message: string, context?: LogContext) {
      if (shouldLog("warn")) {
        const { prefix } = formatMessage("warn", message, context);
        console.warn(`${prefix} ${message}`, context || "");
      }
    },

    error(message: string, context?: LogContext) {
      if (shouldLog("error")) {
        const { prefix } = formatMessage("error", message, context);
        console.error(`${prefix} ${message}`, context || "");
      }
    },
  };
}

// Pre-configured loggers for common modules
export const parserLogger = createLogger("Parser");
export const chatLogger = createLogger("Chat");
export const workspaceLogger = createLogger("Workspace");
export const sessionLogger = createLogger("SessionState");
export const artifactLogger = createLogger("Artifact");
export const realtimeLogger = createLogger("Realtime");
export const authLogger = createLogger("Auth");
export const profileLogger = createLogger("Profile");
export const dashboardLogger = createLogger("Dashboard");
export const networkLogger = createLogger("Network");
export const validatorLogger = createLogger("Validator");
export const errorLogger = createLogger("Error");
