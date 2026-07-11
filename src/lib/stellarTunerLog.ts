import { fetch } from '@tauri-apps/plugin-http';
import type { StellarNowPlayingResponse } from '../types/stellarTunerLog';

const NOWPLAYING_URL = 'https://api.stellartunerlog.com/v1/nowplaying';

export async function getNowPlaying(apiKey: string): Promise<StellarNowPlayingResponse> {
  const res = await fetch(NOWPLAYING_URL, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`StellarTunerLog /nowplaying failed: HTTP ${res.status}`);
  }
  return res.json();
}
