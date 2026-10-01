/**
 * Structured JSON logging.
 *
 * This existed as a documented-but-unimplemented claim until now. Without it a
 * job that fails at 3am is completely silent: the worker swallows the error
 * (deliberately, so one bad job cannot take the server down) and the only
 * trace is a row in the database that nobody is watching.
 *
 * One JSON object per line, so a log shipper can parse it without a regex.
 * Secrets never reach here: callers pass identifiers, and `redact` is a
 * backstop rather than the primary control.
 */

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

/** Keys whose values must never be written, at any nesting depth. */
const SECRET_KEYS = new Set([
  "password",
  "newpassword",
  "new_password",
  "currentpassword",
  "current_password",
  "old_password",
  "token",
  "tokenhash",
  "token_hash",
  "access_token",
  "refresh_token",
  "session_token",
  "secret",
  "authsecret",
  "auth_secret",
  "client_secret",
  "apikey",
  "api_key",
  "api-key",
  "private_key",
  "authorization",
  "cookie",
  "setcookie",
  "set_cookie",
  "passwordhash",
  "password_hash",
  "credential",
  "credentials",
  "session",
  "csrf",
  "csrf_token",
]);

const REDACTED = "[redacted]";

/** Replaces secret-looking values anywhere in the field tree. */
export function redact(fields: LogFields, seen: WeakSet<object> = new WeakSet()): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      out[key] = REDACTED;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // A caller can hand us anything. Recursing into a cycle would blow the
      // stack, and a logger that crashes the process is worse than no logger.
      if (seen.has(value as object)) {
        out[key] = "[circular]";
        continue;
      }
      seen.add(value as object);
      out[key] = redact(value as LogFields, seen);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function emit(level: LogLevel, msg: string, fields: LogFields = {}): void {
  const base = { ts: new Date().toISOString(), level, msg };
  let line: string;
  try {
    line = JSON.stringify({ ...base, ...redact(fields) });
  } catch {
    // A BigInt or an exotic value in a field must not lose the event.
    line = JSON.stringify({ ...base, note: "log fields could not be serialised" });
  }
  // stdout, not console.log: keeps the output a single line with no prefix
  // under load, and survives a wrapped console in tests.
  process.stdout.write(`${line}\n`);
}

export const log = {
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};

/** Normalizes an unknown thrown value into something safe to log. */
export function describeError(e: unknown): { name: string; message: string } {
  if (e instanceof Error) return { name: e.name, message: e.message };
  return { name: "Unknown", message: String(e).slice(0, 200) };
}
