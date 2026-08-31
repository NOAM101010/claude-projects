import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setMuted, setVolume } from '../audio/sfx'
import { refreshMusicGain, setMusicEnabled } from '../audio/music'
import { setVoiceEnabled } from '../audio/voice'

export type Speed = 'slow' | 'normal' | 'fast'

/** Multiplier applied to every animation and dealer delay. */
export const SPEED_FACTOR: Record<Speed, number> = {
  slow: 1.5,
  normal: 1,
  fast: 0.5,
}

interface SettingsState {
  muted: boolean
  volume: number
  musicOn: boolean
  voiceOn: boolean
  speed: Speed
  trainerMode: boolean
  setMutedPref: (v: boolean) => void
  setVolumePref: (v: number) => void
  setMusicOn: (v: boolean) => void
  setVoiceOn: (v: boolean) => void
  setSpeed: (v: Speed) => void
  setTrainerMode: (v: boolean) => void
  factor: () => number
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      muted: false,
      volume: 0.7,
      musicOn: true,
      voiceOn: true,
      speed: 'normal',
      trainerMode: false,
      setMutedPref: v => {
        setMuted(v)
        refreshMusicGain()
        set({ muted: v })
      },
      setVolumePref: v => {
        setVolume(v)
        refreshMusicGain()
        set({ volume: v })
      },
      setMusicOn: v => {
        setMusicEnabled(v)
        set({ musicOn: v })
      },
      setVoiceOn: v => {
        setVoiceEnabled(v)
        set({ voiceOn: v })
      },
      setSpeed: v => set({ speed: v }),
      setTrainerMode: v => set({ trainerMode: v }),
      factor: () => SPEED_FACTOR[get().speed],
    }),
    {
      name: 'bj3d-settings',
      onRehydrateStorage: () => state => {
        // Push the restored preferences into the audio layer on load.
        if (state) {
          setMuted(state.muted)
          setVolume(state.volume)
          setMusicEnabled(state.musicOn)
          setVoiceEnabled(state.voiceOn ?? true)
        }
      },
    }
  )
)
