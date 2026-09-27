import { useQueryClient } from '@tanstack/react-query';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Experience, LoginResponse, Me, NextStep, SessionTokens } from '@edventure/contracts';
import type { AppLocale } from '@edventure/i18n';
import { api, isNetworkError, onApiEvent, tokenStore } from './api';
import { applyLocale } from './i18n';
import { bindOfflineStore, wipeOfflineStore } from './offline';
import { registerForPush, unregisterPush } from './push';

const EXPERIENCE_KEY = 'edventure.experience';
/** Minimal profile (name, roles, school) so the app can open offline; cleared on sign-out. */
const ME_KEY = 'edventure.me';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: Status;
  me: Me | null;
  next: NextStep | null;
  experience: Experience | null;
  outdated: boolean;
  signIn(input: { schoolCode: string; username: string; password: string }): Promise<NextStep>;
  signOut(): Promise<void>;
  reload(): Promise<NextStep | null>;
  storeTokens(tokens: SessionTokens | undefined): Promise<void>;
  chooseExperience(e: Experience): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

/** Signed-in account; only valid inside the signed-in part of the app. */
export function useMe() {
  const { me } = useSession();
  if (!me) throw new Error('Not signed in');
  return me;
}

/** Teachers use the teacher experience by default even if they also administer the school. */
function defaultExperience(me: Me, preferred: string | null): Experience | null {
  if (preferred && me.experiences.includes(preferred as Experience)) return preferred as Experience;
  return (['teacher', 'student', 'admin'] as const).find((e) => me.experiences.includes(e)) ?? null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [next, setNext] = useState<NextStep | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [outdated, setOutdated] = useState(false);
  const accountRef = useRef<string | null>(null);

  const adopt = useCallback(async (m: Me, n: NextStep, online = true) => {
    const scope = `${m.school.id}:${m.accountId}`;
    if (accountRef.current && accountRef.current !== scope) qc.clear();
    accountRef.current = scope;
    await bindOfflineStore(scope).catch(() => undefined);
    setMe(m);
    setNext(n);
    setExperience(defaultExperience(m, await SecureStore.getItemAsync(EXPERIENCE_KEY)));
    setStatus('signedIn');
    if (!online) return;
    if (n === 'ready') await SecureStore.setItemAsync(ME_KEY, JSON.stringify(m));
    await applyLocale(m.locale as AppLocale);
    if (n === 'ready') void registerForPush(m.locale as AppLocale);
  }, [qc]);

  const clearLocal = useCallback(async () => {
    await tokenStore.clear();
    await wipeOfflineStore();
    await SecureStore.deleteItemAsync(EXPERIENCE_KEY);
    await SecureStore.deleteItemAsync(ME_KEY);
    qc.clear();
    accountRef.current = null;
    setMe(null);
    setNext(null);
    setExperience(null);
    setStatus('signedOut');
  }, [qc]);

  const reload = useCallback(async () => {
    try {
      const r = await api.get<{ me: Me; next: NextStep }>('/me');
      await adopt(r.me, r.next);
      return r.next;
    } catch (e) {
      if (isNetworkError(e)) throw e;
      return null;
    }
  }, [adopt]);

  useEffect(() => {
    void (async () => {
      if (!(await tokenStore.get())) return setStatus('signedOut');
      try {
        if ((await reload()) === null) await clearLocal();
      } catch {
        // Offline at start-up: continue with the last known profile so cached timetables and
        // attendance drafts stay usable. Everything is re-checked when the connection returns.
        const cached = await SecureStore.getItemAsync(ME_KEY);
        if (cached) await adopt(JSON.parse(cached) as Me, 'ready', false);
        else setStatus('signedOut');
      }
    })();
    return onApiEvent((event) => {
      if (event === 'client-outdated') setOutdated(true);
      if (event === 'session-ended') void clearLocal();
    });
  }, [reload, clearLocal, adopt]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      me,
      next,
      experience,
      outdated,
      async signIn(input) {
        const r = await api.post<LoginResponse>('/auth/login', {
          ...input,
          deviceName: Device.deviceName ?? Device.modelName ?? undefined,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
        if (r.tokens) await tokenStore.set(r.tokens);
        await adopt(r.me, r.next);
        return r.next;
      },
      async signOut() {
        await unregisterPush();
        await api.post('/auth/logout').catch(() => undefined);
        await clearLocal();
      },
      reload,
      async storeTokens(tokens) {
        if (tokens) await tokenStore.set(tokens);
      },
      async chooseExperience(e) {
        await SecureStore.setItemAsync(EXPERIENCE_KEY, e);
        setExperience(e);
      },
    }),
    [status, me, next, experience, outdated, adopt, clearLocal, reload],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
