import { db, isRemoteId } from './supabase';
import { checkLimit } from '@/lib/rateLimit';

/**
 * User-submitted bug reports.
 *
 * Every report captures a snapshot of the browser context alongside the
 * description, so a report of "the pot did not pay out" arrives with the
 * URL, viewport size, and user agent already attached — no back-and-forth
 * to reproduce what the reporter was looking at.
 */
export const bugReportService = {
  async submit(userId: string, description: string): Promise<{ ok: boolean; reason?: string }> {
    const client = db();
    if (!client) return { ok: false, reason: 'offline' };
    if (!description.trim()) return { ok: false, reason: 'empty' };
    if (!checkLimit(userId, 'bugReport')) return { ok: false, reason: 'rate-limited' };

    const payload = {
      user_id: isRemoteId(userId) ? userId : null,
      description: description.trim().slice(0, 2000),
      url: window.location.href,
      user_agent: navigator.userAgent,
      browser_info: {
        language: navigator.language,
        platform: (navigator as { platform?: string }).platform ?? 'unknown',
        online: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
        vendor: (navigator as { vendor?: string }).vendor ?? 'unknown',
      },
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
    };

    const { error } = await client.from('bug_reports').insert(payload);
    return { ok: !error, reason: error?.message };
  },
};
