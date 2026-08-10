import "server-only";
import { redact } from "./audit/redact";

/**
 * Structured server logger.
 *
 * Every payload passes through the same redaction list used by the audit
 * writer, so a credential cannot reach the logs by being attached to an error
 * object — the ESLint `no-console` rule in src/server/** exists to force code
 * through here rather than around it.
 */

type Level = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function emit(level: Level, message: string, payload?: LogPayload): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(payload ? redact(payload) : {}),
  };

  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  // This module is the single sanctioned stdout sink; the no-console rule in
  // src/server/** exists to force other server code through it.
  // eslint-disable-next-line no-console
  else console.log(line);
}

export const logger = {
  debug: (message: string, payload?: LogPayload) => {
    if (process.env.NODE_ENV !== "production") emit("debug", message, payload);
  },
  info: (message: string, payload?: LogPayload) => emit("info", message, payload),
  warn: (message: string, payload?: LogPayload) => emit("warn", message, payload),
  error: (message: string, payload?: LogPayload) => emit("error", message, payload),
};
