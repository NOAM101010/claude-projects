import { db, isOnline } from './supabase';
import { localStore, emptySave, DEFAULT_EQUIPPED, STARTING_CHIPS } from './localStore';
import type { AvatarConfig, Profile } from '@/types';
import { randInt } from '@/lib/random';
import type { SupabaseClient, User } from '@supabase/supabase-js';

const GUEST_NAMES = ['Ace', 'Lucky', 'Royal', 'Dealer', 'Shark', 'Chip'];

/**
 * Why an attempt to get in did not work.
 *
 * Every one of these used to arrive at the same "something went wrong" toast,
 * which is the worst possible answer: a wrong password, an unconfirmed address
 * and a provider the project never switched on all look identical, so there is
 * nothing the player — or whoever set the project up — can act on.
 */
export type AuthFailure =
  | 'offline'
  | 'missing-fields'
  | 'invalid-credentials'
  | 'email-not-confirmed'
  | 'email-taken'
  | 'weak-password'
  | 'invalid-email'
  | 'guest-disabled'
  | 'signup-disabled'
  | 'rate-limited'
  | 'needs-confirmation'
  | 'network'
  | 'reset-link-invalid'
  | 'unknown';

export class AuthError extends Error {
  constructor(readonly failure: AuthFailure, readonly detail?: string) {
    super(failure);
    this.name = 'AuthError';
  }
}

/** Supabase reports the same condition under different names across versions. */
function classify(error: { code?: string; status?: number; message?: string } | null): AuthFailure {
  if (!error) return 'unknown';
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  const has = (...needles: string[]) => needles.some((needle) => code.includes(needle) || message.includes(needle));

  if (has('anonymous_provider_disabled', 'anonymous sign-ins are disabled')) return 'guest-disabled';
  if (has('signup_disabled', 'signups not allowed', 'sign-ups are disabled')) return 'signup-disabled';
  if (has('email_not_confirmed', 'email not confirmed')) return 'email-not-confirmed';
  if (has('user_already_exists', 'already registered', 'already been registered')) return 'email-taken';
  if (has('weak_password', 'password should be at least', 'at least 6 characters')) return 'weak-password';
  if (has('validation_failed', 'invalid email', 'unable to validate email')) return 'invalid-email';
  if (has('invalid_credentials', 'invalid login credentials')) return 'invalid-credentials';
  if (has('over_request_rate_limit', 'over_email_send_rate_limit', 'rate limit', 'too many requests')) return 'rate-limited';
  if (has('failed to fetch', 'networkerror', 'network request failed')) return 'network';
  if (has('otp_expired', 'expired', 'invalid_recovery_token', 'session_not_found')) return 'reset-link-invalid';
  if (error.status === 400 || error.status === 401) return 'invalid-credentials';
  return 'unknown';
}

export function makeGuestProfile(username?: string, avatar?: AvatarConfig): Profile {
  const name = username?.trim() || `${GUEST_NAMES[randInt(0, GUEST_NAMES.length - 1)]}${randInt(10, 99)}`;
  return {
    id: `guest_${Math.random().toString(36).slice(2, 10)}`,
    username: name,
    tag: `#${randInt(1000, 9999)}`,
    avatar: avatar ?? { skin: 0, hair: 0, shirt: 'base' },
    chips: STARTING_CHIPS,
    xp: 0,
    level: 1,
    lastMilestoneClaimed: 0,
    joinedAt: new Date().toISOString(),
    presence: 'online',
    currentGame: null,
    isGuest: true,
    equipped: { ...DEFAULT_EQUIPPED },
    favoriteGame: null,
  };
}

/**
 * The profile row for a signed-in user, creating it if the trigger never did.
 *
 * A session without a `profiles` row is the single most damaging state this app
 * can be in: the id is real, so nothing looks broken, but every policy keyed on
 * `auth.uid() = user_id` refuses the write and `buy_item` charges a balance that
 * does not exist. Sign-in, sign-up, guest entry and restore all come through
 * here so none of them can leave the app in it.
 */
async function ensureProfile(
  client: SupabaseClient,
  user: User,
  hints?: { username?: string; avatar?: AvatarConfig },
): Promise<Profile> {
  const { data: row } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (row) return rowToProfile(row);

  const local = localStore.read()?.profile;
  const carryLocal = local && local.id.startsWith('guest_');
  const seeded: Profile = {
    ...makeGuestProfile(
      hints?.username ?? (user.user_metadata?.username as string | undefined) ?? local?.username,
      hints?.avatar ?? (user.user_metadata?.avatar as AvatarConfig | undefined) ?? local?.avatar,
    ),
    id: user.id,
    isGuest: Boolean((user as { is_anonymous?: boolean }).is_anonymous),
    // Only a device-local guest's progress may follow them into a new account;
    // another account's leftovers on this device must never be adopted.
    chips: carryLocal ? local!.chips : STARTING_CHIPS,
    xp: carryLocal ? local!.xp : 0,
    level: carryLocal ? local!.level : 1,
  };

  const { data: created } = await client
    .from('profiles')
    .upsert({
      id: seeded.id,
      username: seeded.username,
      tag: seeded.tag,
      avatar: seeded.avatar,
      chips: Math.round(seeded.chips),
      xp: seeded.xp,
      level: seeded.level,
      equipped: seeded.equipped,
      is_guest: seeded.isGuest,
    }, { onConflict: 'id' })
    .select('*')
    .maybeSingle();
  await client.from('player_stats').upsert({ user_id: user.id }, { onConflict: 'user_id' });
  return created ? rowToProfile(created) : seeded;
}

export const authService = {
  online: isOnline,

  /** True when Supabase still holds a live session for this device. */
  async hasSession(): Promise<boolean> {
    const client = db();
    if (!client) return false;
    const { data } = await client.auth.getSession();
    return Boolean(data.session);
  },

  /**
   * Fires whenever the session appears or disappears — including a refresh that
   * failed while the tab was asleep. Without this the app kept rendering a
   * signed-in player over a dead session, and every server call answered 403.
   */
  onSessionLost(handler: () => void) {
    const client = db();
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) handler();
    });
    return () => data.subscription.unsubscribe();
  },

  /**
   * Fires once the recovery link's URL fragment has been parsed and a session
   * established — `detectSessionInUrl` (src/services/supabase.ts) does that part
   * automatically before this ever runs. This is only the signal to swap the UI
   * into "set a new password" instead of the normal signed-in flow.
   */
  onPasswordRecovery(handler: () => void) {
    const client = db();
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') handler();
    });
    return () => data.subscription.unsubscribe();
  },

  async requestPasswordReset(email: string) {
    const client = db();
    if (!client) throw new AuthError('offline');
    if (!email.trim()) throw new AuthError('missing-fields');
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw new AuthError(classify(error), error.message);
  },

  async updatePassword(newPassword: string) {
    const client = db();
    if (!client) throw new AuthError('offline');
    if (!newPassword) throw new AuthError('missing-fields');
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw new AuthError(classify(error), error.message);
  },

  /** Restores a session: Supabase first, device save as fallback. */
  async restore(): Promise<Profile | null> {
    const client = db();
    if (client) {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (user) return ensureProfile(client, user);

      /* No session. A save left behind by a signed-in account is not an
         identity we may reuse — its uuid would be sent on every request while
         `auth.uid()` is null, which is the ghost state that made the shop and
         stats fail silently. Only a device-local guest survives a lost session. */
      const saved = localStore.read()?.profile ?? null;
      return saved && saved.id.startsWith('guest_') ? saved : null;
    }
    return localStore.read()?.profile ?? null;
  },

  async signUp(email: string, password: string, username: string, avatar: AvatarConfig): Promise<Profile> {
    const client = db();
    if (!client) throw new AuthError('offline');
    if (!email.trim() || !password) throw new AuthError('missing-fields');

    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username, avatar } },
    });
    if (error) throw new AuthError(classify(error), error.message);
    if (!data.user) throw new AuthError('unknown');

    /* With "Confirm email" on, sign-up returns a user but no session. Every
       write below would be refused by RLS, and the old code reported it as a
       generic failure — so the account existed but the player was told it had
       not worked. Say what actually happened instead. */
    if (!data.session) throw new AuthError('needs-confirmation');

    const profile = await ensureProfile(client, data.user, { username, avatar });
    await client.from('profiles').update({ username, avatar }).eq('id', data.user.id);
    return { ...profile, username, avatar };
  },

  async signIn(email: string, password: string): Promise<Profile> {
    const client = db();
    if (!client) throw new AuthError('offline');
    if (!email.trim() || !password) throw new AuthError('missing-fields');

    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new AuthError(classify(error), error.message);
    if (!data.user) throw new AuthError('unknown');
    // Credentials were right; a missing profile row is ours to repair, not a
    // reason to refuse a player who just authenticated successfully.
    return ensureProfile(client, data.user);
  },

  /** Guest play: a real anonymous session when the backend allows it. */
  async signInAsGuest(username?: string, avatar?: AvatarConfig): Promise<Profile> {
    const client = db();
    if (!client) {
      const local = makeGuestProfile(username, avatar);
      localStore.write(emptySave(local));
      return local;
    }

    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) {
      /* Falling back to a `guest_…` id here is not harmless: that id is not a
         uuid, so friends, rooms, chat and the shop all switch themselves off
         with no explanation. Play still works offline, but the reason has to
         reach the surface. */
      throw new AuthError(classify(error), error?.message);
    }

    const profile = await ensureProfile(client, data.user, { username, avatar });
    if (username?.trim() || avatar) {
      const patch = {
        ...(username?.trim() ? { username: username.trim() } : {}),
        ...(avatar ? { avatar } : {}),
      };
      await client.from('profiles').update(patch).eq('id', data.user.id);
      return { ...profile, ...patch };
    }
    return profile;
  },

  /** Guest play with no backend at all — the offline escape hatch. */
  playLocally(username?: string, avatar?: AvatarConfig): Profile {
    const local = makeGuestProfile(username, avatar);
    localStore.write(emptySave(local));
    return local;
  },

  async signOut() {
    await db()?.auth.signOut();
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToProfile(row: any): Profile {
  return {
    id: row.id,
    username: row.username,
    tag: row.tag ?? '#0000',
    avatar: row.avatar ?? { skin: 0, hair: 0, shirt: 'base' },
    chips: row.chips ?? STARTING_CHIPS,
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    lastMilestoneClaimed: row.last_milestone_claimed ?? 0,
    joinedAt: row.created_at ?? new Date().toISOString(),
    presence: row.presence ?? 'online',
    currentGame: row.current_game ?? null,
    isGuest: row.is_guest ?? false,
    equipped: { ...DEFAULT_EQUIPPED, ...(row.equipped ?? {}) },
    favoriteGame: row.favorite_game ?? null,
    isAdmin: row.is_admin ?? false,
  };
}
