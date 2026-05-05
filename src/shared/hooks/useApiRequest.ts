import { useCallback, useState } from 'react';

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useApiRequest<T, TArgs extends unknown[]>(
  requestFn: (...args: TArgs) => Promise<T>
): ApiState<T> & { run: (...args: TArgs) => Promise<T>; clearError: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        const result = await requestFn(...args);
        setData(result);
        return result;
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'Request failed';
        setError(message);
        throw requestError;
      } finally {
        setLoading(false);
      }
    },
    [requestFn]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    run,
    clearError,
  };
}
