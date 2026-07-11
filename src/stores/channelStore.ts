import { create } from 'zustand';
import type { XtreamChannel } from '../types/xtream';
import { getLiveStreams, type XtreamCredentials } from '../lib/xtream';

interface ChannelState {
  channels: XtreamChannel[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
  fetchChannels: (creds: XtreamCredentials, categoryId: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  status: 'idle',
  error: null,
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
}));
