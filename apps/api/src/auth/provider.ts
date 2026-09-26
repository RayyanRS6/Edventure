/**
 * Authentication is delegated to a provider (Supabase Auth in staging/production). The backend
 * never stores or reveals passwords; it only asks the provider to create identities, set new
 * temporary passwords, sign in, refresh and sign out.
 */
export interface ProviderSession {
  authUserId: string;
  /** Provider session id (Supabase `session_id` claim). Application sessions are keyed on it. */
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  aal: 'aal1' | 'aal2';
}

export interface VerifiedAccessToken {
  authUserId: string;
  sessionId: string;
  aal: 'aal1' | 'aal2';
  expiresAt: Date;
}

export interface MfaEnrollment {
  factorId: string;
  otpauthUri: string;
  secret: string;
}

export interface AuthProvider {
  readonly kind: 'supabase' | 'local';
  init(): Promise<void>;
  close(): Promise<void>;

  /**
   * Creates the identity with a caller-chosen id (the account id), so a retried provisioning attempt
   * after a timeout finds the same identity instead of creating a duplicate. Idempotent: if the
   * identity already exists, its password is replaced.
   */
  createIdentity(input: { id: string; email: string; password: string; metadata: Record<string, string> }): Promise<{ authUserId: string }>;
  setPassword(authUserId: string, password: string): Promise<void>;
  setDisabled(authUserId: string, disabled: boolean): Promise<void>;
  deleteIdentity(authUserId: string): Promise<void>;

  signInWithPassword(email: string, password: string): Promise<ProviderSession | null>;
  refresh(refreshToken: string): Promise<ProviderSession | null>;
  verifyAccessToken(token: string): Promise<VerifiedAccessToken | null>;
  /** Ends one provider session. Application-level revocation happens independently and immediately. */
  signOut(accessToken: string): Promise<void>;

  mfaFactors(accessToken: string, authUserId: string): Promise<Array<{ id: string; verified: boolean }>>;
  mfaEnroll(accessToken: string, authUserId: string, label: string): Promise<MfaEnrollment>;
  /** Verifies a TOTP code and returns an upgraded (aal2) session. */
  mfaVerify(accessToken: string, authUserId: string, factorId: string, code: string): Promise<ProviderSession | null>;
}

/** Immutable, opaque internal identifier used as the provider "email". It is never mailed to. */
export const identityEmail = (accountId: string, domain: string) => `${accountId}@${domain}`;
