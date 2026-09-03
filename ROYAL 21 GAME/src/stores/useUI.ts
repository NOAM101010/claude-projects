import { create } from 'zustand';

export type MomentKind = 'levelUp' | 'blackjack' | 'bigWin' | 'rareItem' | 'friendJoined' | 'sessionEnd';

export interface Moment {
  id: string;
  kind: MomentKind;
  title: string;
  subtitle?: string;
  icon?: string;
  /** ms; hero moments stay short on purpose (§103) */
  duration?: number;
}

export interface Toast {
  id: string;
  text: string;
  tone: 'neutral' | 'good' | 'bad';
  icon?: string;
}

export type PanelKind = 'friends' | 'notifications' | 'settings' | 'chips' | 'missions' | null;

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface UIState {
  toasts: Toast[];
  moment: Moment | null;
  panel: PanelKind;
  /** When the friends panel opens, jump straight to this tab (hub "invite" card). */
  friendsTab: 'add' | null;
  /** Side menu drawer. On desktop the rail is always visible; this is the compact drawer. */
  navOpen: boolean;
  loading: string | null;
  connectionLost: boolean;
  /** Modal confirmation prompt — used for "leave game?" and similar destructive actions. */
  confirmPrompt: ConfirmRequest | null;
  setNavOpen: (value: boolean) => void;
  toggleNav: () => void;
  toast: (text: string, tone?: Toast['tone'], icon?: string) => void;
  dropToast: (id: string) => void;
  showMoment: (moment: Omit<Moment, 'id'>) => void;
  clearMoment: () => void;
  openPanel: (panel: PanelKind) => void;
  /** Open the friends panel on the "add" tab (invite surface). */
  openFriendsAdd: () => void;
  clearFriendsTab: () => void;
  setLoading: (label: string | null) => void;
  setConnectionLost: (value: boolean) => void;
  confirm: (request: ConfirmRequest) => void;
  closeConfirm: () => void;
}

export const useUI = create<UIState>()((set) => ({
  toasts: [],
  moment: null,
  panel: null,
  friendsTab: null,
  navOpen: false,
  loading: null,
  connectionLost: false,
  confirmPrompt: null,

  setNavOpen: (navOpen) => set({ navOpen }),
  toggleNav: () => set((state) => ({ navOpen: !state.navOpen })),

  toast: (text, tone = 'neutral', icon) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { id, text, tone, icon }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dropToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  showMoment: (moment) => set({ moment: { ...moment, id: Math.random().toString(36).slice(2) } }),
  clearMoment: () => set({ moment: null }),
  openPanel: (panel) => set({ panel }),
  openFriendsAdd: () => set({ panel: 'friends', friendsTab: 'add' }),
  clearFriendsTab: () => set({ friendsTab: null }),
  setLoading: (loading) => set({ loading }),
  setConnectionLost: (connectionLost) => set({ connectionLost }),
  confirm: (request) => set({ confirmPrompt: request }),
  closeConfirm: () => set({ confirmPrompt: null }),
}));
