import { create } from 'zustand';
import type { XtreamChannel } from '../types/xtream';
import type { StellarStation } from '../types/stellarTunerLog';
import { getLiveStreams, type XtreamCredentials } from '../lib/xtream';
import { getNowPlaying } from '../lib/stellarTunerLog';
import { buildNowPlayingMap } from '../lib/channelMatcher';

interface ChannelState {
  channels: XtreamChannel[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
  nowPlaying: Map<number, StellarStation>;
  fetchChannels: (creds: XtreamCredentials, categoryId: string) => Promise<void>;
  pollNowPlaying: (apiKey: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  status: 'idle',
  error: null,
  nowPlaying: new Map(),
  async fetchChannels(creds, categoryId) {
    set({ status: 'loading', error: null });
    try {
      const channels = await getLiveStreams(creds, categoryId);
      channels.sort((a, b) => a.num - b.num);
      set({ channels, status: 'loaded' });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
  async pollNowPlaying(apiKey) {
    const { channels } = get();
    if (channels.length === 0) return;
    try {
      const response = await getNowPlaying(apiKey);
      const stations = Object.values(response.stations);
      set({ nowPlaying: buildNowPlayingMap(channels, stations) });
    } catch {
      // transient poll failure - keep showing the last known now-playing data
    }
  },
}));
