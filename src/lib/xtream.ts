import { fetch } from '@tauri-apps/plugin-http';
import type { XtreamCategory, XtreamChannel } from '../types/xtream';

export interface XtreamCredentials {
  baseUrl: string;
  username: string;
  password: string;
}

function playerApiUrl(creds: XtreamCredentials, params: Record<string, string>) {
  const url = new URL('/player_api.php', creds.baseUrl);
  url.searchParams.set('username', creds.username);
  url.searchParams.set('password', creds.password);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function getLiveCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const res = await fetch(playerApiUrl(creds, { action: 'get_live_categories' }));
  if (!res.ok) {
    throw new Error(`get_live_categories failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function getLiveStreams(
  creds: XtreamCredentials,
  categoryId: string,
): Promise<XtreamChannel[]> {
  const res = await fetch(
    playerApiUrl(creds, { action: 'get_live_streams', category_id: categoryId }),
  );
  if (!res.ok) {
    throw new Error(`get_live_streams failed: HTTP ${res.status}`);
  }
  return res.json();
}

export function buildStreamUrl(
  creds: XtreamCredentials,
  streamId: number,
  extension: string,
): string {
  const base = creds.baseUrl.replace(/\/+$/, '');
  return `${base}/live/${creds.username}/${creds.password}/${streamId}${extension}`;
}
