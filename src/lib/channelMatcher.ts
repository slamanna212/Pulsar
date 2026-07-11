import type { XtreamChannel } from '../types/xtream';
import type { StellarChannel, StellarStation } from '../types/stellarTunerLog';

export const MATCH_THRESHOLD = 0.85;

export function normalizeChannelName(name: string): string {
  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/^the\s+/, '');
  normalized = normalized.replace(/\s+(hd|radio)$/i, '');
  normalized = normalized.replace(/[^a-z0-9]+/g, '');
  return normalized;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function nameSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export function findBestMatch<T>(
  xtreamName: string,
  items: T[],
  nameOf: (item: T) => string,
): T | null {
  const target = normalizeChannelName(xtreamName);
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = nameSimilarity(target, normalizeChannelName(nameOf(item)));
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

export function findBestStationMatch(
  xtreamName: string,
  stations: StellarStation[],
): StellarStation | null {
  return findBestMatch(xtreamName, stations, (station) => station.name);
}

export function buildNowPlayingMap(
  channels: XtreamChannel[],
  stations: StellarStation[],
): Map<number, StellarStation> {
  const map = new Map<number, StellarStation>();
  for (const channel of channels) {
    const match = findBestStationMatch(channel.name, stations);
    if (match) {
      map.set(channel.stream_id, match);
    }
  }
  return map;
}

export function buildChannelMetadataMap(
  channels: XtreamChannel[],
  stellarChannels: StellarChannel[],
): Map<number, StellarChannel> {
  const map = new Map<number, StellarChannel>();
  for (const channel of channels) {
    const match = findBestMatch(channel.name, stellarChannels, (c) => c.marketing_name || c.name);
    if (match) {
      map.set(channel.stream_id, match);
    }
  }
  return map;
}
