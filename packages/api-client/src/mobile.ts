import { CLIENT_HEADER, CLIENT_VERSION_HEADER, IDEMPOTENCY_HEADER, type SessionTokens } from '@edventure/contracts';
import { ApiError, buildUrl, parseResponse, singleFlight, type Method, type RequestOptions, type Transport } from './core';

export interface TokenStore {
  get(): Promise<SessionTokens | null>;
  set(tokens: SessionTokens): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Mobile transport: bearer tokens kept in the device's secure store. Refresh attempts are serialized
 * (single flight) so a rotating refresh token is never used twice by concurrent requests.
 */
export function createMobileTransport(options: {
  baseUrl: string;
  tokens: TokenStore;
  appVersion: string;
  onSessionEnded?: (reason: string) => void;
  onClientOutdated?: () => void;
}): Transport {
  const refresh = singleFlight(async (): Promise<SessionTokens | null> => {
    const current = await options.tokens.get();
    if (!current?.refreshToken) return null;
    const res = await fetch(buildUrl(options.baseUrl, '/auth/refresh'), {
      method: 'POST',
      headers: { [CLIENT_HEADER]: 'mobile', [CLIENT_VERSION_HEADER]: options.appVersion, 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    }).catch(() => null);
    if (!res) throw new ApiError(0, { code: 'network', message: 'Could not reach the server' });
    if (!res.ok) {
      await options.tokens.clear();
      return null;
    }
    const data = (await res.json()) as { tokens?: SessionTokens };
    if (!data.tokens) return null;
    await options.tokens.set(data.tokens);
    return data.tokens;
  });

  async function send<T>(method: Method, path: string, o: RequestOptions, retried: boolean): Promise<T> {
    let tokens = await options.tokens.get();
    // Refresh shortly before expiry to avoid a failed request round trip.
    if (tokens && Date.parse(tokens.expiresAt) - Date.now() < 30_000 && !path.startsWith('/auth/')) tokens = (await refresh()) ?? tokens;
    const headers: Record<string, string> = {
      [CLIENT_HEADER]: 'mobile',
      [CLIENT_VERSION_HEADER]: options.appVersion,
      ...(tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...o.headers,
    };
    if (o.body !== undefined) headers['content-type'] = 'application/json';
    if (o.idempotencyKey) headers[IDEMPOTENCY_HEADER] = o.idempotencyKey;
    let res: Response;
    try {
      res = await fetch(buildUrl(options.baseUrl, path, o.query), {
        method,
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: o.signal,
      });
    } catch {
      throw new ApiError(0, { code: 'network', message: 'Could not reach the server' });
    }
    if (res.status === 426) options.onClientOutdated?.();
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      const body = (await res.clone().json().catch(() => ({}))) as { code?: string };
      if (body.code === 'unauthenticated' && !retried && (await refresh())) return send<T>(method, path, o, true);
      await options.tokens.clear();
      options.onSessionEnded?.(body.code ?? 'unauthenticated');
    }
    return parseResponse<T>(res, o.raw);
  }

  return { request: (method, path, o = {}) => send(method, path, o, false) };
}
