import {
  loadPendingCartOperationsFromStorage,
  markCartOperationSynced,
} from '@/src/features/cart/data/cartLocalDataSource';
import type { CartOperation } from '@/src/features/cart/model/types';
import { applyCartConflicts } from '@/src/features/cart/sync/conflictResolver';
import { sendCartOperation } from '@/src/services/api/client';
import { logError, logWarning } from '@/src/services/logging/logger';

function isNetworkSyncError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('network request failed') || message.includes('failed to fetch');
}

export async function flushPendingCartOperations(limit?: number): Promise<number> {
  const pendingRows = loadPendingCartOperationsFromStorage();
  const rowsToProcess = typeof limit === 'number' ? pendingRows.slice(0, limit) : pendingRows;

  let processed = 0;

  for (const row of rowsToProcess) {
    const operation: CartOperation = {
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      timestamp: row.timestamp,
      synced: row.synced === 1,
    };

    try {
      const result = await sendCartOperation(operation);

      // Conflict strategy:
      // 1) server accepts operation but may return authoritative conflicts,
      // 2) we apply local fixes immediately before marking operation synced.
      if (result.conflicts && result.conflicts.length > 0) {
        applyCartConflicts(result.conflicts);
      }

      markCartOperationSynced(row.id);
      processed += 1;
    } catch (error) {
      const metadata = {
        operationId: row.id,
        error: error instanceof Error ? error.message : String(error),
      };

      if (isNetworkSyncError(error)) {
        // Keep operation pending for retry without noisy fatal logs.
        logWarning('Cart sync deferred (network unavailable)', metadata);
      } else {
        logError('Cart sync failed for operation', metadata);
      }
      throw error;
    }
  }

  return processed;
}
