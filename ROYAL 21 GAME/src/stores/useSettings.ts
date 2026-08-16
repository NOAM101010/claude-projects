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
  setLang: (lang: Lang) => void;
  setLevel: (bus: Bus, value: number) => void;
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
  const { lang, master, music, sfx, ambient, quality, reducedMotion, haptics, showPresence } = state;
  try {
    localStorage.setItem(KEY, JSON.stringify({ lang, master, music, sfx, ambient, quality, reducedMotion, haptics, showPresence }));
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

  setLang: (lang) => {
    set({ lang });
    applyLang(lang);
    persist(get());
  },
  setLevel: (bus, value) => {
    set({ [bus]: value } as unknown as Partial<SettingsState>);
    audio.setLevel(bus, value);
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
