import { create } from 'zustand'

export type OverlayPanel =
  | 'menu' | 'shop' | 'profile' | 'leaderboard' | 'achievements' | 'settings' | 'skins' | 'vip' | null

interface OverlayState {
  panel: OverlayPanel
  open: (panel: Exclude<OverlayPanel, null>) => void
  close: () => void
  toggleMenu: () => void
}

/** Releases the mouse so overlay buttons are clickable in the pointer-locked lobby. */
function releasePointer() {
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock?.()
  }
}

export const useOverlay = create<OverlayState>((set, get) => ({
  panel: null,
  open: panel => {
    releasePointer()
    set({ panel })
  },
  close: () => set({ panel: null }),
  toggleMenu: () => {
    const isOpen = get().panel !== null
    if (isOpen) {
      set({ panel: null })
    } else {
      releasePointer()
      set({ panel: 'menu' })
    }
  },
}))
