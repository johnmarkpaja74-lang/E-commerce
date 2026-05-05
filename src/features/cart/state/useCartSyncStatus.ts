import { useEffect, useState } from 'react';

import { getPendingCartOperationCount } from '@/src/features/cart/data/cartLocalDataSource';
import { isOnline, subscribeConnectivity } from '@/src/services/network/connectivity';

type CartSyncStatus = {
  online: boolean;
  pendingOperations: number;
};

const POLL_INTERVAL_MS = 1500;

export function useCartSyncStatus(): CartSyncStatus {
  const [online, setOnline] = useState<boolean>(isOnline());
  const [pendingOperations, setPendingOperations] = useState<number>(getPendingCartOperationCount());

  useEffect(() => {
    const unsubscribe = subscribeConnectivity((nextOnline) => {
      setOnline(nextOnline);
    });

    const timer = setInterval(() => {
      setPendingOperations(getPendingCartOperationCount());
    }, POLL_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return {
    online,
    pendingOperations,
  };
}
