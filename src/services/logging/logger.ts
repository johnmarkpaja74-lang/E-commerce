export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  if (__DEV__) {
    // Keep logs cheap and structured while developing.
    console.log('[info]', message, metadata ?? {});
  }
}

export function logWarning(message: string, metadata?: Record<string, unknown>): void {
  if (__DEV__) {
    console.warn('[warn]', message, metadata ?? {});
  }
}

export function logError(message: string, metadata?: Record<string, unknown>): void {
  console.error('[error]', message, metadata ?? {});
}
