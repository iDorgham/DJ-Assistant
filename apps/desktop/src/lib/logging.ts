/**
 * Small, dependency-free logger for the desktop renderer.
 *
 * Diagnostics must never copy credentials or a user's home-directory path into
 * the console, a report or a screenshot. Redaction is deliberately conservative:
 * it removes the common secret shapes and the personal parts of file paths, then
 * leaves normal application text alone.
 */

const SECRET_ASSIGNMENT =
  /(authorization|access[_-]?token|refresh[_-]?token|api[_-]?key|password|secret)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const WINDOWS_USER_PATH = /\b[A-Za-z]:\\Users\\[^\\\s]+/g;
const POSIX_USER_PATH = /\/Users\/[^/\s]+/g;
const EMAIL_ADDRESS = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const URL_SECRET = /([?&](?:token|key|secret|password)=)[^&\s]+/gi;

export function redact(text: string): string {
  return text
    .replace(BEARER_TOKEN, "Bearer [redacted]")
    .replace(SECRET_ASSIGNMENT, "$1=[redacted]")
    .replace(WINDOWS_USER_PATH, (match) => match.replace(/[^\\]+$/, "[user]"))
    .replace(POSIX_USER_PATH, "/Users/[user]")
    .replace(EMAIL_ADDRESS, "[email]")
    .replace(URL_SECRET, "$1[redacted]");
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function contextText(context: unknown): string {
  if (context === undefined) return "";
  try {
    return ` ${JSON.stringify(context)}`;
  } catch {
    return " [unserializable context]";
  }
}

export function logError(scope: string, error: unknown, context?: unknown): void {
  console.error(`[${scope}] ${redact(errorText(error))}${redact(contextText(context))}`);
}

export function logWarning(scope: string, message: string, context?: unknown): void {
  console.warn(`[${scope}] ${redact(message)}${redact(contextText(context))}`);
}
