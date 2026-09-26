import { randomInt } from 'node:crypto';

// No look-alike characters (0/O, 1/l/I) so temporary passwords can be read aloud or printed.
const LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/** Temporary password shown once to the administrator; the user must replace it on first sign-in. */
export function generateTemporaryPassword(groups = 3, groupLength = 4): string {
  const alphabet = LETTERS + DIGITS;
  for (;;) {
    const parts: string[] = [];
    for (let g = 0; g < groups; g++) {
      let part = '';
      for (let i = 0; i < groupLength; i++) part += alphabet[randomInt(alphabet.length)];
      parts.push(part);
    }
    const value = parts.join('-');
    if (/[A-Za-z]/.test(value) && /\d/.test(value)) return value;
  }
}

/** Unusable random password for identities provisioned in bulk before activation. */
export function generateUnusablePassword(): string {
  return generateTemporaryPassword(6, 6);
}
