export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  retries?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export async function requestJsonWithRetry<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers,
    retries = 2,
    retryDelayMs = 500,
    signal,
  } = options;

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(`HTTP ${response.status}: ${text || 'Request failed'}`);

        if (attempt < retries && isRetriableStatus(response.status)) {
          const delay = retryDelayMs * 2 ** attempt;
          await sleep(delay);
          attempt += 1;
          continue;
        }

        throw error;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      if (attempt < retries && isNetworkError(error)) {
        const delay = retryDelayMs * 2 ** attempt;
        await sleep(delay);
        attempt += 1;
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}
