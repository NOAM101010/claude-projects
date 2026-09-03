import { create } from 'zustand';
import { audio, type Bus } from '@/audio/AudioManager';
import { applyLang } from '@/i18n';
import { setHaptics } from '@/lib/haptics';
import type { Lang } from '@/types';

export type Quality = 'auto' | 'low' | 'medium' | 'high';

interface SettingsState {
  lang: Lang;
  master: number;
  music: number;
  sfx: number;
  ambient: number;
  quality: Quality;
  reducedMotion: boolean;
  haptics: boolean;
  showPresence: boolean;
  muted: boolean;
  preMute: { master: number; music: number; sfx: number; ambient: number } | null;
  setLang: (lang: Lang) => void;
  setLevel: (bus: Bus, value: number) => void;
  toggleMuteAll: () => void;
  setQuality: (quality: Quality) => void;
  setReducedMotion: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setShowPresence: (value: boolean) => void;
  hydrate: () => void;
}

const KEY = 'royal21.settings.v1';

/** Devices with few cores or a small screen get the low tier automatically. */
function autoQuality(): Exclude<Quality, 'auto'> {
  if (typeof navigator === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency ?? 4;
  const small = typeof window !== 'undefined' && window.innerWidth < 640;
  if (cores <= 4 || small) return 'medium';
  return 'high';
}

function persist(state: SettingsState) {
  const { lang, master, music, sfx, ambient, quality, reducedMotion, haptics, showPresence, muted, preMute } = state;
  try {
    localStorage.setItem(KEY, JSON.stringify({ lang, master, music, sfx, ambient, quality, reducedMotion, haptics, showPresence, muted, preMute }));
  } catch { /* ignore */ }
}

function applyDocument(state: SettingsState) {
  const resolved = state.quality === 'auto' ? autoQuality() : state.quality;
  document.documentElement.dataset.quality = resolved;
  document.documentElement.dataset.motion = state.reducedMotion ? 'reduced' : 'full';
}

export const useSettings = create<SettingsState>()((set, get) => ({
  lang: 'he',
  master: 0.7,
  music: 0.35,
  sfx: 0.8,
  ambient: 0.4,
  quality: 'auto',
  reducedMotion: false,
  haptics: true,
  showPresence: true,
  muted: false,
  preMute: null,

  setLang: (lang) => {
    set({ lang });
    applyLang(lang);
    persist(get());
  },
  setLevel: (bus, value) => {
    set({ [bus]: value, muted: false, preMute: null } as unknown as Partial<SettingsState>);
    audio.setLevel(bus, value);
    persist(get());
  },
  toggleMuteAll: () => {
    const buses: Bus[] = ['master', 'music', 'sfx', 'ambient'];
    const s = get();
    if (s.muted) {
      const p = s.preMute ?? { master: 0.7, music: 0.35, sfx: 0.8, ambient: 0.4 };
      set({ muted: false, preMute: null, ...p });
      buses.forEach((bus) => audio.setLevel(bus, p[bus]));
    } else {
      const p = { master: s.master, music: s.music, sfx: s.sfx, ambient: s.ambient };
      set({ muted: true, preMute: p, master: 0, music: 0, sfx: 0, ambient: 0 });
      buses.forEach((bus) => audio.setLevel(bus, 0));
    }
    persist(get());
  },
  setQuality: (quality) => {
    set({ quality });
    applyDocument(get());
    persist(get());
  },
  setReducedMotion: (value) => {
    set({ reducedMotion: value });
    applyDocument(get());
    persist(get());
  },
  setHapticsEnabled: (value) => {
    set({ haptics: value });
    setHaptics(value);
    persist(get());
  },
  setShowPresence: (value) => {
    set({ showPresence: value });
    persist(get());
  },

  hydrate: () => {
    let saved: Partial<SettingsState> = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SettingsState>;
    } catch { /* ignore */ }
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    set({ ...saved, reducedMotion: saved.reducedMotion ?? prefersReduced });
    const state = get();
    applyLang(state.lang);
    applyDocument(state);
    setHaptics(state.haptics);
    (['master', 'music', 'sfx', 'ambient'] as Bus[]).forEach((bus) => audio.setLevel(bus, state[bus]));
  },
}));

export const resolvedQuality = (quality: Quality) => (quality === 'auto' ? autoQuality() : quality);
