type LogLevel = "error" | "warn" | "info";

function formatPayload(
  scope: string,
  message: string,
  detail?: unknown,
): string {
  const entry = {
    ts: new Date().toISOString(),
    scope,
    message,
    ...(detail !== undefined ? { detail } : {}),
  };
  return JSON.stringify(entry);
}

export function logError(scope: string, message: string, detail?: unknown): void {
  console.error(formatPayload(scope, message, detail));
}

export function logWarn(scope: string, message: string, detail?: unknown): void {
  console.warn(formatPayload(scope, message, detail));
}

export function logInfo(scope: string, message: string, detail?: unknown): void {
  console.info(formatPayload(scope, message, detail));
}

export type { LogLevel };
