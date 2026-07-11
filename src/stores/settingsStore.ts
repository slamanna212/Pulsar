import { create } from 'zustand';
import { load, type Store } from '@tauri-apps/plugin-store';

export interface Settings {
  baseUrl: string;
  username: string;
  password: string;
  streamExtension: string;
  categoryId: string | null;
  categoryName: string | null;
  stellarApiKey: string;
  pollIntervalSec: number;
  defaultVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '',
  username: '',
  password: '',
  streamExtension: '.ts',
  categoryId: null,
  categoryName: null,
  stellarApiKey: '',
  pollIntervalSec: 25,
  defaultVolume: 70,
};

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
}

let storePromise: Promise<Store> | null = null;
function getStore() {
  if (!storePromise) {
    storePromise = load('settings.json', { autoSave: false });
  }
  return storePromise;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    const store = await getStore();
    const stored = await store.get<Settings>('settings');
    set({ settings: { ...DEFAULT_SETTINGS, ...stored }, loaded: true });
  },
  async update(patch) {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    const store = await getStore();
    await store.set('settings', next);
    await store.save();
  },
}));
