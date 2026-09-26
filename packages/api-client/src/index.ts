import type { RequestOptions, Transport } from './core';

export * from './core';

/**
 * Thin typed wrapper shared by the website and the mobile app. Both call the same backend; only the
 * transport differs (`./web` uses cookies, `./mobile` uses secure-store tokens). Response types come
 * from `@edventure/contracts` (e.g. `api.get<Me>('/me')`).
 */
export function createClient(transport: Transport) {
  return {
    get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => transport.request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => transport.request<T>('POST', path, { ...options, body: body ?? {} }),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) => transport.request<T>('PUT', path, { ...options, body: body ?? {} }),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => transport.request<T>('PATCH', path, { ...options, body: body ?? {} }),
    delete: <T>(path: string, body?: unknown, options?: RequestOptions) => transport.request<T>('DELETE', path, { ...options, body }),
  };
}

export type EdventureClient = ReturnType<typeof createClient>;
