import type { ApiErrorBody, ErrorCode } from '@edventure/contracts';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** Sends an Idempotency-Key so a retried submission is applied at most once. */
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Return the raw Response (downloads). */
  raw?: boolean;
}

export interface Transport {
  request<T>(method: Method, path: string, options?: RequestOptions): Promise<T>;
}

/** Structured error from the API (`{ code, message, fieldErrors, requestId }`) or the network. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'network';
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(status: number, body: Partial<ApiErrorBody> & { code?: ErrorCode | 'network' }) {
    super(body.message ?? 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code ?? 'internal';
    this.fieldErrors = body.fieldErrors;
    this.details = body.details;
    this.requestId = body.requestId;
  }

  get isConflict() {
    return this.code === 'conflict' || this.code === 'version_conflict';
  }
}

export function buildUrl(base: string, path: string, query?: Query) {
  const url = `${base.replace(/\/$/, '')}/api/v1${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function parseResponse<T>(res: Response, raw?: boolean): Promise<T> {
  if (raw && res.ok) return res as unknown as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) throw new ApiError(res.status, (data ?? {}) as Partial<ApiErrorBody>);
  return data as T;
}

export const newIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

/** Serializes concurrent refreshes so rotating refresh tokens are never used twice. */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
