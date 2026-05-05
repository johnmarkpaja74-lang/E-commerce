import { useCallback, useEffect, useState } from 'react';

import {
  fetchProducts,
  type FetchProductsResult,
  type Product,
} from '@/src/services/api/commerceApi';

const DEFAULT_PAGE_SIZE = 10;

type UsePaginatedProductsResult = {
  products: Product[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  retryInitialLoad: () => Promise<void>;
};

export function usePaginatedProducts(): UsePaginatedProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPageResult = useCallback((result: FetchProductsResult, nextPage: number) => {
    setProducts((previous) => (nextPage === 1 ? result.items : [...previous, ...result.items]));
    setHasMore(result.hasMore);
    setPage(nextPage);
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, mode: 'initial' | 'more' | 'refresh'): Promise<void> => {
      if (mode === 'initial') {
        setLoading(true);
      }
      if (mode === 'more') {
        setLoadingMore(true);
      }
      if (mode === 'refresh') {
        setRefreshing(true);
      }

      if (mode !== 'more') {
        setError(null);
      }

      try {
        const result = await fetchProducts({ page: nextPage, pageSize: DEFAULT_PAGE_SIZE });
        applyPageResult(result, nextPage);
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Failed to load products';
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [applyPageResult]
  );

  useEffect(() => {
    void loadPage(1, 'initial');
  }, [loadPage]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loading || loadingMore || refreshing || !hasMore) {
      return;
    }

    await loadPage(page + 1, 'more');
  }, [hasMore, loadPage, loading, loadingMore, page, refreshing]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadPage(1, 'refresh');
  }, [loadPage]);

  const retryInitialLoad = useCallback(async (): Promise<void> => {
    await loadPage(1, 'initial');
  }, [loadPage]);

  return {
    products,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    loadMore,
    refresh,
    retryInitialLoad,
  };
}
