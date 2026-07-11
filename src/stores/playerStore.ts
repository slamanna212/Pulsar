import { create } from 'zustand';
import type { XtreamChannel } from '../types/xtream';
import type { PlayerState } from '../types/player';
import {
  GET_PROPERTY_REQUEST_ID,
  getProperty,
  loadUrl,
  onMpvEvent,
  setPause,
  setVolume as mpvSetVolume,
} from '../lib/mpvClient';
import { buildStreamUrl, type XtreamCredentials } from '../lib/xtream';
import { onMediaControlEvent, setMediaPlayback } from '../lib/mediaSession';

interface PlayerActions {
  initEventListener: () => void;
  selectChannel: (
    channel: XtreamChannel,
    creds: XtreamCredentials,
    streamExtension: string,
  ) => Promise<void>;
  togglePause: () => Promise<void>;
  setPlaying: (playing: boolean) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
}

type PlayerStore = PlayerState & PlayerActions;

let listening = false;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
let fallbackStartTimer: ReturnType<typeof setTimeout> | null = null;

function stopFallbackPolling() {
  if (fallbackStartTimer) {
    clearTimeout(fallbackStartTimer);
    fallbackStartTimer = null;
  }
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  status: 'idle',
  currentChannel: null,
  volume: 70,
  bitrateKbps: null,

  initEventListener() {
    if (listening) return;
    listening = true;
    onMpvEvent((event) => {
      if (event.event === 'property-change' && event.name === 'audio-bitrate') {
        const bits = typeof event.data === 'number' ? event.data : null;
        if (bits) {
          set({ bitrateKbps: Math.round(bits / 1000) });
          stopFallbackPolling();
        } else {
          set({ bitrateKbps: null });
        }
      } else if (event.request_id === GET_PROPERTY_REQUEST_ID && typeof event.data === 'number') {
        // Fallback reply: packet-audio-bitrate, used when the container never
        // populates audio-bitrate live (see PLAN.md section 5).
        set({ bitrateKbps: Math.round(event.data / 1000) });
        stopFallbackPolling();
      }
    });
    onMediaControlEvent((kind) => {
      if (!get().currentChannel) return;
      if (kind === 'toggle') {
        get().togglePause();
      } else {
        get().setPlaying(kind === 'play');
      }
    });
  },

  async selectChannel(channel, creds, streamExtension) {
    stopFallbackPolling();
    set({ status: 'loading', currentChannel: channel, bitrateKbps: null });
    try {
      const url = buildStreamUrl(creds, channel.stream_id, streamExtension);
      await loadUrl(url);
      await mpvSetVolume(get().volume);
      set({ status: 'playing' });
      await setMediaPlayback(true);

      fallbackStartTimer = setTimeout(() => {
        if (get().bitrateKbps != null || get().currentChannel?.stream_id !== channel.stream_id) return;
        fallbackTimer = setInterval(() => {
          if (get().bitrateKbps != null) {
            stopFallbackPolling();
            return;
          }
          getProperty('packet-audio-bitrate');
        }, 2500);
      }, 3000);
    } catch (err) {
      set({ status: 'error' });
      throw err;
    }
  },

  async togglePause() {
    await get().setPlaying(get().status !== 'playing');
  },

  async setPlaying(playing) {
    await setPause(!playing);
    set({ status: playing ? 'playing' : 'paused' });
    await setMediaPlayback(playing);
  },

  async setVolume(volume) {
    set({ volume });
    if (get().currentChannel) {
      await mpvSetVolume(volume);
    }
  },
}));
