'use client';

import { ApiError, createClient, newIdempotencyKey } from '@edventure/api-client';
import { createWebTransport } from '@edventure/api-client/web';

/** The one backend. Requests go to `/api/v1/...` on this origin and are proxied to the Edventure API. */
export const api = createClient(
  createWebTransport({
    onSessionEnded: () => {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
    },
  }),
);

export { ApiError, newIdempotencyKey };

export function errorMessage(error: unknown, fallback = 'Something went wrong') {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function fieldError(error: unknown, field: string): string | undefined {
  if (error instanceof ApiError && error.fieldErrors) {
    return error.fieldErrors[field]?.[0] ?? Object.entries(error.fieldErrors).find(([k]) => k.endsWith(`.${field}`))?.[1]?.[0];
  }
  return undefined;
}

/** Triggers a browser download for an authorized file link returned by the API. */
export async function downloadFile(fileId: string) {
  const link = await api.get<{ url: string }>(`/files/${fileId}/download`);
  window.location.assign(link.url);
}
