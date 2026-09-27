import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { isRunningInExpoGo } from 'expo';

/**
 * Encrypted on-device store (SQLCipher) for the confirmed offline uses only: previously loaded
 * timetables and homework summaries, minimal class rosters, and attendance drafts.
 *
 * - The database belongs to one school account; signing in as someone else wipes it.
 * - Rows expire after the school's offline window (7 days by default).
 * - Nothing sensitive (fees, salary, guardians, documents) is ever written here.
 */
const DB_NAME = 'edventure-offline.db';
const KEY_NAME = 'edventure.offline-key';
export const DEFAULT_RETENTION_DAYS = 7;

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;
// Expo Go does not include our SQLCipher build. Keep its preview data in process memory only.
const previewStore = {
  scope: null as string | null,
  retentionDays: DEFAULT_RETENTION_DAYS,
  cache: new Map<string, Stored<unknown>>(),
  drafts: new Map<string, Stored<unknown>>(),
};

function previewTable(table: 'cache' | 'drafts') {
  return previewStore[table];
}

async function encryptionKey() {
  let key = await SecureStore.getItemAsync(KEY_NAME);
  if (!key) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  }
  return key;
}

async function open() {
  if (db) return db;
  opening ??= (async () => {
    const handle = await SQLite.openDatabaseAsync(DB_NAME);
    // The key is hex, so it cannot break out of the string literal.
    await handle.execAsync(`PRAGMA key = "x'${await encryptionKey()}'";`);
    await handle.execAsync(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, saved_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS drafts (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, saved_at INTEGER NOT NULL);
    `);
    db = handle;
    return handle;
  })();
  try {
    return await opening;
  } finally {
    opening = null;
  }
}

/** Binds the store to one school account and drops anything older than the retention window. */
export async function bindOfflineStore(scope: string, retentionDays = DEFAULT_RETENTION_DAYS) {
  if (isRunningInExpoGo()) {
    if (previewStore.scope !== scope) {
      previewStore.cache.clear();
      previewStore.drafts.clear();
    }
    previewStore.scope = scope;
    previewStore.retentionDays = retentionDays;
    return;
  }
  const d = await open();
  const row = await d.getFirstAsync<{ v: string }>('SELECT v FROM meta WHERE k = ?', 'scope');
  if (row && row.v !== scope) await d.execAsync('DELETE FROM cache; DELETE FROM drafts;');
  await d.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', 'scope', scope);
  const cutoff = Date.now() - retentionDays * 86_400_000;
  await d.runAsync('DELETE FROM cache WHERE saved_at < ?', cutoff);
  await d.runAsync('DELETE FROM drafts WHERE saved_at < ?', cutoff);
}

/** Removes every locally stored record and the database key (sign-out, account switch). */
export async function wipeOfflineStore() {
  if (isRunningInExpoGo()) {
    previewStore.cache.clear();
    previewStore.drafts.clear();
    previewStore.scope = null;
    return;
  }
  if (db) {
    await db.closeAsync().catch(() => undefined);
    db = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => undefined);
  await SecureStore.deleteItemAsync(KEY_NAME).catch(() => undefined);
}

export type Stored<T> = { value: T; savedAt: number };

async function read<T>(table: 'cache' | 'drafts', key: string): Promise<Stored<T> | null> {
  if (isRunningInExpoGo()) {
    const stored = previewTable(table).get(key);
    if (!stored) return null;
    if (stored.savedAt < Date.now() - previewStore.retentionDays * 86_400_000) {
      previewTable(table).delete(key);
      return null;
    }
    return stored as Stored<T>;
  }
  const d = await open();
  const row = await d.getFirstAsync<{ value: string; saved_at: number }>(`SELECT value, saved_at FROM ${table} WHERE key = ?`, key);
  return row ? { value: JSON.parse(row.value) as T, savedAt: row.saved_at } : null;
}

async function write(table: 'cache' | 'drafts', key: string, value: unknown) {
  if (isRunningInExpoGo()) {
    previewTable(table).set(key, { value, savedAt: Date.now() });
    return;
  }
  const d = await open();
  await d.runAsync(`INSERT OR REPLACE INTO ${table} (key, value, saved_at) VALUES (?, ?, ?)`, key, JSON.stringify(value), Date.now());
}

/** Keys allowed in the read cache. Anything else is never persisted. */
export type CacheKey = `schedule:${string}` | `homework:${string}` | `roster:${string}`;

export const offlineCache = {
  get: <T>(key: CacheKey) => read<T>('cache', key),
  set: (key: CacheKey, value: unknown) => write('cache', key, value),
};

export const rollCallDraftKey = (sectionId: string, date: string) => `rollcall:${sectionId}:${date}`;

export const offlineDrafts = {
  get: <T>(key: string) => read<T>('drafts', key),
  set: (key: string, value: unknown) => write('drafts', key, value),
  async remove(key: string) {
    if (isRunningInExpoGo()) {
      previewStore.drafts.delete(key);
      return;
    }
    const d = await open();
    await d.runAsync('DELETE FROM drafts WHERE key = ?', key);
  },
  async keys(prefix: string) {
    if (isRunningInExpoGo()) return [...previewStore.drafts.keys()].filter((key) => key.startsWith(prefix));
    const d = await open();
    const rows = await d.getAllAsync<{ key: string }>('SELECT key FROM drafts WHERE key LIKE ?', `${prefix}%`);
    return rows.map((r) => r.key);
  },
};
