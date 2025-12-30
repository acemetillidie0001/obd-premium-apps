/**
 * Structured Logger for API Routes
 * 
 * Provides consistent, structured logging with event names and metadata.
 * Automatically filters out secrets, tokens, and PII.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  event: string;
  level: LogLevel;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// Secrets and sensitive patterns to filter from logs
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /bearer/i,
  /authorization/i,
  /apikey/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /session[_-]?id/i,
];

// Common keys that might contain sensitive data
const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authToken",
  "auth_token",
  "bearer",
  "authorization",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "sessionId",
  "session_id",
  "prompt", // Full prompts can be large and may contain PII
  "content", // AI responses can be very large
]);

/**
 * Filter sensitive data from metadata object
 */
function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Skip if key matches sensitive patterns
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Handle nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else if (typeof value === "string" && value.length > 1000) {
      // Truncate very long strings (likely prompts/responses)
      sanitized[key] = value.substring(0, 1000) + "... [TRUNCATED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Internal log function
 */
function log(level: LogLevel, event: string, metadata?: Record<string, unknown>): void {
  const sanitized = sanitizeMetadata(metadata);
  const entry: LogEntry = {
    event,
    level,
    metadata: sanitized,
    timestamp: new Date().toISOString(),
  };

  const logMessage = `[API:${event}]`;
  const logData = sanitized && Object.keys(sanitized).length > 0 ? sanitized : undefined;

  switch (level) {
    case "debug":
      // Only log debug in development
      if (process.env.NODE_ENV === "development" && logData) {
        console.debug(logMessage, logData);
      } else if (process.env.NODE_ENV === "development") {
        console.debug(logMessage);
      }
      break;
    case "info":
      if (logData) {
        console.log(logMessage, logData);
      } else {
        console.log(logMessage);
      }
      break;
    case "warn":
      if (logData) {
        console.warn(logMessage, logData);
      } else {
        console.warn(logMessage);
      }
      break;
    case "error":
      if (logData) {
        console.error(logMessage, logData);
      } else {
        console.error(logMessage);
      }
      break;
  }
}

/**
 * Structured logger for API routes
 */
export const apiLogger = {
  /**
   * Log debug events (detailed diagnostics, only in development)
   */
  debug: (event: string, metadata?: Record<string, unknown>) => {
    log("debug", event, metadata);
  },

  /**
   * Log informational events (request start, successful operations)
   */
  info: (event: string, metadata?: Record<string, unknown>) => {
    log("info", event, metadata);
  },

  /**
   * Log warnings (non-fatal issues, deprecations)
   */
  warn: (event: string, metadata?: Record<string, unknown>) => {
    log("warn", event, metadata);
  },

  /**
   * Log errors (failures, exceptions)
   */
  error: (event: string, metadata?: Record<string, unknown>) => {
    log("error", event, metadata);
  },
};

