import { flushPendingCartOperations } from '@/src/features/cart/sync/cartSync';
import { logError, logInfo, logWarning } from '@/src/services/logging/logger';
import {
  isOnline,
  startConnectivityMonitoring,
  subscribeConnectivity,
} from '@/src/services/network/connectivity';

type QueueConfig = {
  maxRetries: number;
  baseDelayMs: number;
};

const defaultConfig: QueueConfig = {
  maxRetries: 5,
  baseDelayMs: 1500,
};

let isProcessing = false;
let stopConnectivitySubscription: (() => void) | null = null;
let retryAttempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let config: QueueConfig = defaultConfig;

function isNetworkQueueError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('network request failed') || message.includes('failed to fetch');
}

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry(): void {
  if (retryAttempts >= config.maxRetries) {
    logError('Offline queue reached max retry attempts', {
      retryAttempts,
    });
    return;
  }

  const delayMs = config.baseDelayMs * 2 ** retryAttempts;
  retryAttempts += 1;

  clearRetryTimer();
  retryTimer = setTimeout(() => {
    void processQueueNow();
  }, delayMs);

  logInfo('Scheduled offline queue retry', { delayMs, retryAttempts });
}

export async function processQueueNow(): Promise<void> {
  if (!isOnline() || isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    const processed = await flushPendingCartOperations();
    retryAttempts = 0;
    clearRetryTimer();

    logInfo('Processed queued operations', { processed });
  } catch (error) {
    const metadata = {
      error: error instanceof Error ? error.message : String(error),
    };

    if (isNetworkQueueError(error)) {
      logWarning('Queue processing deferred (network unavailable)', metadata);
    } else {
      logError('Queue processing failed', metadata);
    }
    scheduleRetry();
  } finally {
    isProcessing = false;
  }
}

export function initializeOfflineQueue(customConfig?: Partial<QueueConfig>): void {
  config = {
    ...defaultConfig,
    ...customConfig,
  };

  startConnectivityMonitoring();

  if (!stopConnectivitySubscription) {
    stopConnectivitySubscription = subscribeConnectivity((online) => {
      if (online) {
        // Auto-process queue immediately when the app becomes online.
        void processQueueNow();
      }
    });
  }

  // Attempt initial processing on app start when online.
  void processQueueNow();
}

export function shutdownOfflineQueue(): void {
  if (stopConnectivitySubscription) {
    stopConnectivitySubscription();
    stopConnectivitySubscription = null;
  }

  clearRetryTimer();
  retryAttempts = 0;
}
