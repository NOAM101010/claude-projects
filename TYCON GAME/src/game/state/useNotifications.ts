/**
 * CITY EMPIRE — Notifications (MASTER §53: every important action gives
 * feedback; no silent failures).
 *
 * A tiny queue of transient toast messages the HUD renders. Any system can
 * push success/info/error feedback here.
 */

import { create } from 'zustand';

export type NoticeKind = 'info' | 'success' | 'error';

export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
}

interface NotificationsState {
  notices: Notice[];
  push: (kind: NoticeKind, text: string, ttlMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useNotifications = create<NotificationsState>((set) => ({
  notices: [],
  push: (kind, text, ttlMs = 3200) => {
    const id = nextId++;
    set((s) => ({ notices: [...s.notices, { id, kind, text }] }));
    setTimeout(() => {
      set((s) => ({ notices: s.notices.filter((n) => n.id !== id) }));
    }, ttlMs);
  },
  dismiss: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));

/** Convenience helpers. */
export const notify = {
  info: (text: string) => useNotifications.getState().push('info', text),
  success: (text: string) => useNotifications.getState().push('success', text),
  error: (text: string) => useNotifications.getState().push('error', text),
};
