import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface MediaSessionMetadata {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
}

export function setMediaMetadata(metadata: MediaSessionMetadata): Promise<void> {
  return invoke('media_session_set_metadata', {
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album ?? null,
    coverUrl: metadata.coverUrl ?? null,
  });
}

export function setMediaPlayback(playing: boolean): Promise<void> {
  return invoke('media_session_set_playback', { playing });
}

export type MediaControlKind = 'play' | 'pause' | 'toggle';

export function onMediaControlEvent(callback: (kind: MediaControlKind) => void) {
  return listen<{ kind: MediaControlKind }>('media-control-event', (e) => callback(e.payload.kind));
}
