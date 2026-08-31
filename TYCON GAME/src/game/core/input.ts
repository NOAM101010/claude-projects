/**
 * CITY EMPIRE — Input service.
 *
 * A tiny, framework-agnostic keyboard/mouse tracker. Gameplay reads
 * it every frame via `input.isDown(...)`; UI never drives gameplay
 * directly (MASTER §8: UI must not own core gameplay state).
 */

type MouseDelta = { x: number; y: number };

class InputService {
  private keys = new Set<string>();
  private mouse: MouseDelta = { x: 0, y: 0 };
  private started = false;

  /** Consumers that want the phone/menus can subscribe to single presses. */
  private pressListeners = new Map<string, Set<() => void>>();

  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.keys.clear();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Ignore repeats for the "just pressed" listeners.
    if (!e.repeat) {
      const set = this.pressListeners.get(e.code);
      if (set) set.forEach((cb) => cb());
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  isDown(code: string) {
    return this.keys.has(code);
  }

  /** Fired once per physical key press (no auto-repeat). Returns unsubscribe. */
  onPress(code: string, cb: () => void) {
    let set = this.pressListeners.get(code);
    if (!set) {
      set = new Set();
      this.pressListeners.set(code, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
    };
  }

  /** Feed pointer movement (pixels) from the pointer-lock handler. */
  addMouseDelta(x: number, y: number) {
    this.mouse.x += x;
    this.mouse.y += y;
  }

  /** Read & clear accumulated mouse delta for this frame. */
  consumeMouseDelta(): MouseDelta {
    const d = { x: this.mouse.x, y: this.mouse.y };
    this.mouse.x = 0;
    this.mouse.y = 0;
    return d;
  }
}

export const input = new InputService();
