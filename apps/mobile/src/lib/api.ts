import * as SecureStore from 'expo-secure-store';
import { ApiError, createClient, newIdempotencyKey } from '@edventure/api-client';
import { createMobileTransport, type TokenStore } from '@edventure/api-client/mobile';
import type { SessionTokens } from '@edventure/contracts';
import { apiUrl, appVersion } from './config';

const TOKENS_KEY = 'edventure.tokens';

/** Tokens live only in the platform keychain/keystore, never in plain storage. */
export const tokenStore: TokenStore = {
  async get() {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as SessionTokens) : null;
  },
  async set(tokens) {
    await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKENS_KEY);
  },
};

type Listener = (event: 'session-ended' | 'client-outdated') => void;
const listeners = new Set<Listener>();
export function onApiEvent(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The same client the website uses; only the transport (bearer tokens) differs. */
export const api = createClient(
  createMobileTransport({
    baseUrl: apiUrl,
    tokens: tokenStore,
    appVersion,
    onSessionEnded: () => listeners.forEach((l) => l('session-ended')),
    onClientOutdated: () => listeners.forEach((l) => l('client-outdated')),
  }),
);

export { ApiError, newIdempotencyKey };

export function errorMessage(error: unknown, fallback = 'Something went wrong') {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export const isNetworkError = (error: unknown) => error instanceof ApiError && error.code === 'network';
