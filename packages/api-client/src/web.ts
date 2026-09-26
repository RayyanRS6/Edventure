import { CLIENT_HEADER, CSRF_HEADER, IDEMPOTENCY_HEADER } from '@edventure/contracts';
import { ApiError, buildUrl, parseResponse, singleFlight, type Method, type RequestOptions, type Transport } from './core';

/**
 * Web transport: the session lives in HttpOnly cookies set by the API (never readable by scripts).
 * Unsafe requests echo the readable CSRF cookie in a header. On an expired access token the
 * transport refreshes once (cookie-based) and retries.
 */
export function createWebTransport(options: { baseUrl?: string; onSessionEnded?: () => void } = {}): Transport {
  const base = options.baseUrl ?? '';
  const csrf = () => {
    if (typeof document === 'undefined') return undefined;
    return document.cookie
      .split('; ')
      .find((c) => c.startsWith('edv_csrf='))
      ?.slice('edv_csrf='.length);
  };
  const refresh = singleFlight(async () => {
    const res = await fetch(buildUrl(base, '/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { [CLIENT_HEADER]: 'web', 'content-type': 'application/json' },
      body: '{}',
    });
    return res.ok;
  });

  async function send<T>(method: Method, path: string, o: RequestOptions, retried: boolean): Promise<T> {
    const headers: Record<string, string> = { [CLIENT_HEADER]: 'web', ...o.headers };
    if (o.body !== undefined) headers['content-type'] = 'application/json';
    if (method !== 'GET') {
      const token = csrf();
      if (token) headers[CSRF_HEADER] = token;
    }
    if (o.idempotencyKey) headers[IDEMPOTENCY_HEADER] = o.idempotencyKey;
    let res: Response;
    try {
      res = await fetch(buildUrl(base, path, o.query), {
        method,
        credentials: 'include',
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: o.signal,
      });
    } catch {
      throw new ApiError(0, { code: 'network', message: 'Could not reach the server' });
    }
    if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
      const body = (await res.clone().json().catch(() => ({}))) as { code?: string };
      if (body.code === 'unauthenticated' && (await refresh())) return send<T>(method, path, o, true);
      options.onSessionEnded?.();
    }
    return parseResponse<T>(res, o.raw);
  }

  return { request: (method, path, o = {}) => send(method, path, o, false) };
}
