import { create } from 'zustand';
import { CAT_ORDER, EXPENSE_CAT_DEFS, PHOTO_SLOT_COUNT, PhotoCat, Person, SEARCH_DIRECTORY, ViewKey } from './data';
import { Lang, T } from './i18n';

export type Screen =
  | 'home' | 'garage' | 'details' | 'trips' | 'trip' | 'service' | 'documents'
  | 'expenses' | 'fuel' | 'notifications' | 'profile' | 'wrap' | 'friends' | 'friend'
  | 'addVehicle' | 'units' | 'privacy' | 'account';

export type Phase = 'splash' | 'auth' | 'welcome' | 'app';

export interface Vehicle {
  id: string; primary: boolean;
  make: string; model: string; year: number; engine: string; hp: number; odo: number; plate: string;
  gearbox?: string; drive?: string; fuel?: string; colour?: string; displacement?: string;
  doors?: number | string; tank?: number; factory?: number;
}
interface ExpenseEntry { amount: number; date: string; note: string }
interface ServiceRecord { id: string; title: string; date: string; cost: number; odo: number }
interface Refuel { id: string; date: string; litres: number; cost: number; station: string }
interface Trip { id: string; from: string; to: string; km: number; min: number; avg: number; max: number; date: string; litres: number }
interface NotificationItem { id: string; icon: string; title: string; body: string; when: number; to?: Screen }

interface StoreState {
  lang: Lang; phase: Phase; splash: number; screen: Screen; stack: Screen[];
  view: ViewKey; angle: number; dragging: boolean; autospin: boolean;
  panX: number; panY: number; frameSheet: boolean; frameCat: PhotoCat; tripId: string;
  body: number; trim: number; fuelMode: number;
  toast: string; streak: number; streakOpen: boolean; primaryId: string;
  vehicles: Vehicle[]; archived: Record<string, boolean>; removed: string[];
  editing: boolean; editVals: Record<string, string>; editErrs: Record<string, string>; vehTab: number;
  confirm: null | 'archive' | 'delete'; confirmTarget: string; confirmText: string;
  welcomeStep: number; wrapMonth: number | null;
  frTab: number; frQuery: string; frFriends: string[]; frRequests: string[]; frSent: string[]; frProfile: string | null;
  expenseEntries: Record<number, ExpenseEntry[]>; expSheet: number | null;
  expForm: { amount: string; date: string; note: string }; expErrs: Record<string, string>;
  photoCats: Record<PhotoCat, string[]>;
  units: { dist: number; vol: number; cons: number; cur: number; date: number };
  privacy: { loc: number; usage: boolean; visible: number; content: boolean };
  pushPermission: 'default' | 'granted' | 'denied';
  locationPermission: 'default' | 'granted' | 'denied';
  account: { name: string; email: string; phone: string };
  serviceSheet: boolean; serviceForm: Record<number, string>; serviceErrs: Record<number, string>;
  serviceHistory: ServiceRecord[];
  refuels: Refuel[]; refuelSheet: boolean; refuelForm: { litres: string; cost: string; station: string }; refuelErrs: Record<string, string>;
  documents: { id: string; label: string; status: string; icon: string }[];
  trips: Trip[];
  notifications: NotificationItem[];

  L: () => (typeof T)['he'];
  i: () => 0 | 1;
  buzz: () => void;
  go: (screen: Screen) => void;
  tab: (screen: Screen) => void;
  back: () => void;
  flash: (msg: string) => void;
  notify: (icon: string, title: string, body: string, to?: Screen) => void;
  setLang: (lang: Lang) => void;
  enterApp: () => void;
  skipWelcome: () => void;
  resetAll: () => void;

  addVehicle: (v: Omit<Vehicle, 'id' | 'primary'>) => void;

  setView: (v: ViewKey) => void;
  setAngle: (a: number | ((prev: number) => number)) => void;
  setDragging: (d: boolean) => void;
  toggleAutospin: () => void;
  openFrameSheet: (cat?: PhotoCat) => void;
  closeFrameSheet: () => void;
  pickPhoto: (cat: PhotoCat, n: number) => void;
  clearPhoto: (cat: PhotoCat, n: number) => void;

  startEdit: () => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  setEditVal: (key: string, val: string) => void;

  archiveVehicle: (id: string) => void;
  restoreVehicle: (id: string) => void;
  deleteVehicleForever: (id: string) => void;
  setPrimary: (id: string) => void;
  askConfirm: (kind: 'archive' | 'delete', id: string) => void;
  cancelConfirm: () => void;
  runConfirm: () => void;
  setConfirmText: (v: string) => void;

  openExpSheet: (cat: number) => void;
  closeExpSheet: () => void;
  setExpForm: (k: 'amount' | 'date' | 'note', v: string) => void;
  saveExpense: () => void;
  deleteExpense: (cat: number, idx: number) => void;

  openServiceSheet: () => void;
  closeServiceSheet: () => void;
  setServiceForm: (idx: number, v: string) => void;
  submitService: () => void;

  openRefuelSheet: () => void;
  closeRefuelSheet: () => void;
  setRefuelForm: (k: 'litres' | 'cost' | 'station', v: string) => void;
  submitRefuel: () => void;
  deleteRefuel: (id: string) => void;

  acceptFriend: (id: string) => void;
  declineFriend: (id: string) => void;
  removeFriend: (id: string) => void;
  requestFriend: (id: string) => void;
  setFrTab: (n: number) => void;
  setFrQuery: (q: string) => void;
  openFriend: (id: string) => void;

  setUnits: (key: keyof StoreState['units'], v: number) => void;
  setPrivacyToggle: (key: 'usage' | 'content') => void;
  setPrivacySeg: (key: 'loc' | 'visible', v: number) => void;
  requestPush: () => void;
  requestLocation: () => void;
  setAccount: (key: keyof StoreState['account'], v: string) => void;

  setWrapMonth: (n: number | null) => void;
  setTripId: (id: string) => void;
}

const STORE_KEY = 'dg.store.v2';
const photoKey = (cat: string, n: number) => `dg.photo.${cat}.${n}`;
const uid = () => Math.random().toString(36).slice(2, 10);

function loadStore(): any {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function persist(patch: Record<string, unknown>) {
  try {
    const next = { ...(loadStore() || {}), ...patch };
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch { /* quota */ }
}
function emptyPhotoCats(): Record<PhotoCat, string[]> {
  const out: any = {};
  CAT_ORDER.forEach((cat) => { out[cat] = new Array(PHOTO_SLOT_COUNT[cat]).fill(''); });
  return out;
}
function loadPhotos(): Record<PhotoCat, string[]> {
  const out = emptyPhotoCats();
  CAT_ORDER.forEach((cat) => {
    for (let n = 0; n < PHOTO_SLOT_COUNT[cat]; n++) {
      try {
        const stored = localStorage.getItem(photoKey(cat, n));
        if (stored) out[cat][n] = stored;
      } catch { /* ignore */ }
    }
  });
  return out;
}
function writePhoto(cat: string, n: number, url: string): boolean {
  try {
    if (url) localStorage.setItem(photoKey(cat, n), url);
    else localStorage.removeItem(photoKey(cat, n));
    return true;
  } catch { return false; }
}
function clearAllPhotos() {
  CAT_ORDER.forEach((cat) => {
    for (let n = 0; n < PHOTO_SLOT_COUNT[cat]; n++) {
      try { localStorage.removeItem(photoKey(cat, n)); } catch { /* ignore */ }
    }
  });
}

const initialStore = loadStore();
const todayStr = new Date().toISOString().slice(0, 10);
const dayBefore = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
let initStreak = 1;
if (initialStore?.lastActive === todayStr) initStreak = initialStore.streak || 1;
else if (initialStore?.lastActive === dayBefore) initStreak = (initialStore.streak || 0) + 1;
persist({ lastActive: todayStr, streak: initStreak });

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<StoreState>((set, get) => ({
  lang: (initialStore?.lang === 'en' || initialStore?.lang === 'he') ? initialStore.lang : 'he',
  phase: 'splash', splash: 0, screen: 'home', stack: [],
  view: 'r360', angle: 34, dragging: false, autospin: false,
  panX: 50, panY: 45, frameSheet: false, frameCat: 'exterior', tripId: '',
  body: 0, trim: 0, fuelMode: 0,
  toast: '', streak: initStreak, streakOpen: false, primaryId: initialStore?.primaryId || '',
  vehicles: initialStore?.vehicles || [],
  archived: initialStore?.archived || {}, removed: initialStore?.removed || [],
  editing: false, editVals: {}, editErrs: {}, vehTab: 0,
  confirm: null, confirmTarget: '', confirmText: '',
  welcomeStep: 0, wrapMonth: null,
  frTab: 0, frQuery: '',
  frFriends: initialStore?.frFriends || [],
  frRequests: initialStore?.frRequests || [],
  frSent: initialStore?.frSent || [], frProfile: null,
  expenseEntries: initialStore?.expenseEntries || {},
  expSheet: null, expForm: { amount: '', date: '', note: '' }, expErrs: {},
  photoCats: loadPhotos(),
  units: { dist: 0, vol: 0, cons: 0, cur: 0, date: 0, ...(initialStore?.units || {}) },
  privacy: { loc: 0, usage: false, visible: 0, content: true, ...(initialStore?.privacy || {}) },
  pushPermission: (typeof Notification !== 'undefined' ? Notification.permission : 'default') as any,
  locationPermission: 'default',
  account: { name: '', email: '', phone: '', ...(initialStore?.account || {}) },
  serviceSheet: false, serviceForm: {}, serviceErrs: {},
  serviceHistory: initialStore?.serviceHistory || [],
  refuels: initialStore?.refuels || [], refuelSheet: false,
  refuelForm: { litres: '', cost: '', station: '' }, refuelErrs: {},
  documents: initialStore?.documents || [],
  trips: initialStore?.trips || [],
  notifications: initialStore?.notifications || [],

  L: () => T[get().lang],
  i: () => (get().lang === 'he' ? 0 : 1),
  buzz: () => { try { navigator.vibrate?.(8); } catch { /* ignore */ } },
  go: (screen) => { get().buzz(); set((s) => ({ screen, stack: [...s.stack, s.screen] })); },
  tab: (screen) => { get().buzz(); set({ screen, stack: [] }); },
  back: () => { get().buzz(); set((s) => ({ screen: s.stack[s.stack.length - 1] || 'home', stack: s.stack.slice(0, -1) })); },
  flash: (msg) => {
    get().buzz();
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: '' }), 2200);
  },
  notify: (icon, title, body, to) => {
    const item: NotificationItem = { id: uid(), icon, title, body, when: Date.now(), to };
    set((s) => {
      const list = [item, ...s.notifications].slice(0, 30);
      persist({ notifications: list });
      return { notifications: list };
    });
  },
  setLang: (lang) => { persist({ lang }); set({ lang }); },
  enterApp: () => {
    get().buzz();
    set({ phase: 'welcome', welcomeStep: 0 });
    setTimeout(() => { if (get().phase === 'welcome') set({ welcomeStep: 1 }); }, 420);
    setTimeout(() => { if (get().phase === 'welcome') set({ welcomeStep: 2 }); }, 1150);
    setTimeout(() => { if (get().phase === 'welcome') set({ welcomeStep: 3 }); }, 2050);
    setTimeout(() => {
      if (get().phase === 'welcome') set({ phase: 'app', screen: get().vehicles.length ? 'home' : 'addVehicle' });
    }, 3150);
  },
  skipWelcome: () => set({ phase: 'app', screen: get().vehicles.length ? 'home' : 'addVehicle' }),
  resetAll: () => {
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    clearAllPhotos();
    location.reload();
  },

  addVehicle: (v) => {
    const s = get();
    const vehicle: Vehicle = { ...v, id: uid(), primary: s.vehicles.length === 0 };
    const nextVehicles = [...s.vehicles, vehicle];
    const nextPrimary = s.primaryId || vehicle.id;
    persist({ vehicles: nextVehicles, primaryId: nextPrimary });
    set({ vehicles: nextVehicles, primaryId: nextPrimary, screen: 'home', stack: [] });
    s.flash(s.L().added);
  },

  setView: (v) => set({ view: v, panX: 50, panY: 45 }),
  setAngle: (a) => set((s) => ({ angle: typeof a === 'function' ? (a as any)(s.angle) : a })),
  setDragging: (d) => set({ dragging: d, ...(d ? { autospin: false } : {}) }),
  toggleAutospin: () => set((s) => ({ autospin: !s.autospin })),
  openFrameSheet: (cat) => { get().buzz(); set({ frameSheet: true, frameCat: cat || get().frameCat }); },
  closeFrameSheet: () => set({ frameSheet: false }),
  pickPhoto: (cat, n) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1000, scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const url = c.toDataURL('image/jpeg', 0.68);
          if (!writePhoto(cat, n, url)) { get().flash('No room to save'); return; }
          get().buzz();
          set((st) => {
            const list = [...(st.photoCats[cat] || [])];
            while (list.length <= n) list.push('');
            list[n] = url;
            return { photoCats: { ...st.photoCats, [cat]: list } };
          });
          get().flash(get().L().added);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },
  clearPhoto: (cat, n) => {
    writePhoto(cat, n, '');
    set((st) => {
      const list = [...(st.photoCats[cat] || [])];
      list[n] = '';
      return { photoCats: { ...st.photoCats, [cat]: list } };
    });
    get().flash('✓');
  },

  startEdit: () => {
    const s = get();
    const car = activeCar(s);
    if (!car) return;
    set({
      editing: true, editErrs: {},
      editVals: {
        plate: car.plate, make: car.make, model: car.model, year: String(car.year),
        engine: car.engine, hp: String(car.hp), odo: String(car.odo),
      },
    });
  },
  cancelEdit: () => set({ editing: false }),
  setEditVal: (key, val) => set((s) => ({ editVals: { ...s.editVals, [key]: val } })),
  saveEdit: () => {
    const s = get(); const L = s.L(); const errs: Record<string, string> = {};
    const v = s.editVals;
    if (!v.model?.trim()) errs.model = L.validation.required;
    if (!/^\d{4}$/.test(v.year || '')) errs.year = L.validation.number;
    if (!/^\d+$/.test((v.odo || '').replace(/,/g, ''))) errs.odo = L.validation.number;
    if (Object.keys(errs).length) { set({ editErrs: errs }); return; }
    const car = activeCar(s);
    if (!car) return;
    const nextVehicles = s.vehicles.map((veh) => veh.id === car.id ? {
      ...veh, plate: v.plate, make: v.make, model: v.model, year: +v.year, engine: v.engine, hp: +v.hp, odo: +(v.odo || '').replace(/,/g, ''),
    } : veh);
    persist({ vehicles: nextVehicles });
    set({ vehicles: nextVehicles, editing: false });
    s.flash(L.savedVehicle);
  },

  setPrimary: (id) => { persist({ primaryId: id }); set({ primaryId: id }); get().flash('★'); },
  archiveVehicle: (id) => {
    const next = { ...get().archived, [id]: true };
    persist({ archived: next }); set({ archived: next, confirm: null });
    get().flash(get().L().archived);
  },
  restoreVehicle: (id) => {
    const next = { ...get().archived }; delete next[id];
    persist({ archived: next }); set({ archived: next });
    get().flash(get().L().restored);
  },
  deleteVehicleForever: (id) => {
    const s = get();
    const next = [...s.removed, id];
    const nextVehicles = s.vehicles.filter((v) => v.id !== id);
    persist({ removed: next, vehicles: nextVehicles }); set({ removed: next, vehicles: nextVehicles, confirm: null, confirmText: '' });
    s.flash(s.L().deleted);
  },
  askConfirm: (kind, id) => set({ confirm: kind, confirmTarget: id, confirmText: '' }),
  cancelConfirm: () => set({ confirm: null, confirmText: '' }),
  setConfirmText: (v) => set({ confirmText: v }),
  runConfirm: () => {
    const s = get();
    if (s.confirm === 'archive') s.archiveVehicle(s.confirmTarget);
    else if (s.confirm === 'delete') s.deleteVehicleForever(s.confirmTarget);
  },

  openExpSheet: (cat) => set({ expSheet: cat, expForm: { amount: '', date: '', note: '' }, expErrs: {} }),
  closeExpSheet: () => set({ expSheet: null }),
  setExpForm: (k, v) => set((s) => ({ expForm: { ...s.expForm, [k]: v } })),
  saveExpense: () => {
    const s = get(); const L = s.L(); const errs: Record<string, string> = {};
    const amt = s.expForm.amount.replace(/[^\d.]/g, '');
    if (!amt || !/^\d+(\.\d+)?$/.test(amt)) errs.amount = L.validation.number;
    if (!s.expForm.date) errs.date = L.validation.required;
    else if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.expForm.date)) errs.date = L.validation.date;
    if (Object.keys(errs).length) { set({ expErrs: errs }); return; }
    const cat = s.expSheet!;
    const next = { ...s.expenseEntries, [cat]: [{ amount: +amt, date: s.expForm.date, note: s.expForm.note.trim() }, ...(s.expenseEntries[cat] || [])] };
    persist({ expenseEntries: next });
    set({ expenseEntries: next, expSheet: null });
    s.flash(L.expAdded);
    const catDef = EXPENSE_CAT_DEFS[cat];
    s.notify('💳', L.expAdded.replace('✓ ', ''), L.notifExpenseAdded(s.i() === 0 ? catDef.he : catDef.en));
  },
  deleteExpense: (cat, idx) => {
    const s = get();
    const next = { ...s.expenseEntries, [cat]: (s.expenseEntries[cat] || []).filter((_, j) => j !== idx) };
    persist({ expenseEntries: next });
    set({ expenseEntries: next });
    s.flash(s.L().expRemoved);
  },

  openServiceSheet: () => set({ serviceSheet: true, serviceForm: {}, serviceErrs: {} }),
  closeServiceSheet: () => set({ serviceSheet: false }),
  setServiceForm: (idx, v) => set((s) => ({ serviceForm: { ...s.serviceForm, [idx]: v } })),
  submitService: () => {
    const s = get(); const L = s.L(); const errs: Record<number, string> = {};
    const val = (n: number) => (s.serviceForm[n] || '').trim();
    [0, 1, 2].forEach((n) => { if (!val(n)) errs[n] = L.validation.required; });
    if (!errs[1] && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val(1))) errs[1] = L.validation.date;
    if (!errs[2] && !/^\d+(\.\d+)?$/.test(val(2).replace(/[,\s₪]/g, ''))) errs[2] = L.validation.number;
    if (Object.keys(errs).length) { set({ serviceErrs: errs }); return; }
    const car = activeCar(s);
    const entry: ServiceRecord = { id: uid(), title: val(0), date: val(1), cost: +val(2).replace(/[,\s₪]/g, ''), odo: car?.odo || 0 };
    const history = [entry, ...s.serviceHistory];
    persist({ serviceHistory: history });
    set({ serviceHistory: history, serviceSheet: false });
    s.flash(L.savedService);
    s.notify('🔧', L.savedService.replace('✓ ', ''), L.notifServiceSaved(entry.title));
  },

  openRefuelSheet: () => set({ refuelSheet: true, refuelForm: { litres: '', cost: '', station: '' }, refuelErrs: {} }),
  closeRefuelSheet: () => set({ refuelSheet: false }),
  setRefuelForm: (k, v) => set((s) => ({ refuelForm: { ...s.refuelForm, [k]: v } })),
  submitRefuel: () => {
    const s = get(); const L = s.L(); const errs: Record<string, string> = {};
    const litres = s.refuelForm.litres.replace(/[^\d.]/g, '');
    const cost = s.refuelForm.cost.replace(/[^\d.]/g, '');
    if (!litres || !/^\d+(\.\d+)?$/.test(litres)) errs.litres = L.validation.number;
    if (!cost || !/^\d+(\.\d+)?$/.test(cost)) errs.cost = L.validation.number;
    if (Object.keys(errs).length) { set({ refuelErrs: errs }); return; }
    const today = new Date();
    const entry: Refuel = {
      id: uid(), date: `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`,
      litres: +litres, cost: +cost, station: s.refuelForm.station.trim(),
    };
    const list = [entry, ...s.refuels];
    persist({ refuels: list });
    set({ refuels: list, refuelSheet: false });
    s.flash(L.loggedRefuel);
    s.notify('⛽', L.loggedRefuel.replace('✓ ', ''), L.notifRefuelLogged(String(entry.litres)));
  },
  deleteRefuel: (id) => {
    const s = get();
    const list = s.refuels.filter((r) => r.id !== id);
    persist({ refuels: list });
    set({ refuels: list });
  },

  acceptFriend: (id) => {
    const s = get(); const person = allPeople(s).find((p) => p.initials === id);
    s.buzz();
    set((st) => {
      const frFriends = [id, ...st.frFriends], frRequests = st.frRequests.filter((x) => x !== id);
      persist({ frFriends, frRequests });
      return { frFriends, frRequests };
    });
    if (person) { s.flash(s.L().frAccepted(person.name[s.i()])); s.notify('🤝', s.L().frAccepted(person.name[s.i()]).replace('✓ ', ''), s.L().notifFriendAccepted(person.name[s.i()])); }
  },
  declineFriend: (id) => {
    const s = get();
    set((st) => { const frRequests = st.frRequests.filter((x) => x !== id); persist({ frRequests }); return { frRequests }; });
    s.flash(s.L().frDeclined);
  },
  removeFriend: (id) => {
    const s = get(); const person = allPeople(s).find((p) => p.initials === id);
    s.buzz();
    set((st) => {
      const frFriends = st.frFriends.filter((x) => x !== id);
      persist({ frFriends });
      return { frFriends, screen: st.screen === 'friend' ? 'friends' : st.screen };
    });
    if (person) s.flash(s.L().frRemoved(person.name[s.i()]));
  },
  requestFriend: (id) => {
    const s = get(); const person = allPeople(s).find((p) => p.initials === id);
    s.buzz();
    set((st) => { const frSent = [...st.frSent, id]; persist({ frSent }); return { frSent }; });
    if (person) s.flash(s.L().frSent(person.name[s.i()]));
  },
  setFrTab: (n) => set({ frTab: n }),
  setFrQuery: (q) => set({ frQuery: q }),
  openFriend: (id) => set((st) => ({ screen: 'friend', stack: [...st.stack, st.screen], frProfile: id })),

  setUnits: (key, v) => { const next = { ...get().units, [key]: v }; persist({ units: next }); set({ units: next }); },
  setPrivacyToggle: (key) => { const next = { ...get().privacy, [key]: !get().privacy[key] }; persist({ privacy: next }); set({ privacy: next }); },
  setPrivacySeg: (key, v) => {
    const next = { ...get().privacy, [key]: v }; persist({ privacy: next }); set({ privacy: next });
    if (key === 'loc' && v !== 2) get().requestLocation();
  },
  requestPush: () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') { set({ pushPermission: 'granted' }); return; }
    if (Notification.permission === 'denied') { set({ pushPermission: 'denied' }); return; }
    Notification.requestPermission().then((perm) => set({ pushPermission: perm as any }));
  },
  requestLocation: () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => set({ locationPermission: 'granted' }),
      () => set({ locationPermission: 'denied' }),
      { timeout: 8000 },
    );
  },
  setAccount: (key, v) => { const next = { ...get().account, [key]: v }; persist({ account: next }); set({ account: next }); },

  setWrapMonth: (n) => set({ wrapMonth: n }),
  setTripId: (id) => set({ tripId: id }),
}));

export function allPeople(_s?: StoreState): Person[] {
  return SEARCH_DIRECTORY;
}

export function activeCar(s: StoreState): Vehicle | null {
  const arch = s.archived || {}, gone = s.removed || [];
  const activeCars = s.vehicles.filter((v) => gone.indexOf(v.id) < 0 && !arch[v.id]);
  return activeCars.find((v) => v.id === s.primaryId) || activeCars[0] || null;
}
export function activeVehicles(s: StoreState) {
  const arch = s.archived || {}, gone = s.removed || [];
  return s.vehicles.filter((v) => gone.indexOf(v.id) < 0 && !arch[v.id]);
}
export function archivedVehicles(s: StoreState) {
  const arch = s.archived || {}, gone = s.removed || [];
  return s.vehicles.filter((v) => gone.indexOf(v.id) < 0 && !!arch[v.id]);
}

// splash / auth timers, run once — the splash ticker self-clears once it
// reaches its final frame, so the app doesn't re-render forever afterwards.
let bootstrapped = false;
export function bootstrapTimers() {
  if (bootstrapped) return;
  bootstrapped = true;
  const splashInterval = setInterval(() => {
    const cur = useStore.getState().splash;
    if (cur < 3) useStore.setState({ splash: cur + 1 });
    else clearInterval(splashInterval);
  }, 320);
  setTimeout(() => useStore.setState({ phase: 'auth' }), 1500);
  const spin = setInterval(() => {
    const st = useStore.getState();
    if (st.autospin && st.view === 'r360' && !st.dragging) useStore.setState({ angle: st.angle + 1.4 });
  }, 45);
  void spin;
}
