import type { AvatarConfig } from '@/types';

const KEY = 'royal21.accounts.v1';
const MAX = 6;

export interface KnownAccount {
  id: string;
  username: string;
  /** Absent for guests — they have nothing to sign back in with. */
  email?: string;
  avatar: AvatarConfig;
  lastUsed: number;
}

/**
 * The accounts this device has signed into before.
 *
 * Supabase keeps one session per client, so "switching user" is really sign out
 * then sign in. Remembering who has played here turns that into tapping a face
 * and typing a password, instead of retyping an address from memory. Passwords
 * are never stored — only the address and how to draw the player.
 */
function read(): KnownAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as KnownAccount[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: KnownAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch { /* private mode; switching just will not be remembered */ }
}

export const accountsService = {
  list(): KnownAccount[] {
    return read().sort((a, b) => b.lastUsed - a.lastUsed);
  },

  /** Records a successful sign-in. Most recent first, de-duplicated by id. */
  remember(account: Omit<KnownAccount, 'lastUsed'>) {
    if (!account.id) return;
    const rest = read().filter((entry) => entry.id !== account.id && (!account.email || entry.email !== account.email));
    write([{ ...account, lastUsed: Date.now() }, ...rest]);
  },

  forget(id: string) {
    write(read().filter((entry) => entry.id !== id));
  },

  clear() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};
