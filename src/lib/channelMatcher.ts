import type { XtreamChannel } from '../types/xtream';
import type { StellarChannel, StellarStation } from '../types/stellarTunerLog';

export const MATCH_THRESHOLD = 0.85;

export function normalizeChannelName(name: string): string {
  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/^radio:\s*/, '');
  normalized = normalized.replace(/^the\s+/, '');
  normalized = normalized.replace(/\s+(hd|radio)$/i, '');
  normalized = normalized.replace(/[^a-z0-9]+/g, '');
  return normalized;
}

// Rolling two-row Levenshtein: O(min·max) time, O(min(len)) space, no per-call
// 2D matrix allocation (this is the innermost op of every fuzzy match below).
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ac = a[i - 1];
    for (let j = 1; j <= b.length; j++) {
      curr[j] =
        ac === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

export function nameSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Given only the two lengths, the highest similarity `nameSimilarity` could
 * return is `min(len)/max(len)` (achieved when the shorter string is a pure
 * subsequence of the longer). Used to skip the O(n·m) Levenshtein entirely for
 * candidates that can't beat the current best / clear the threshold.
 */
function lengthUpperBound(aLen: number, bLen: number): number {
  const maxLen = Math.max(aLen, bLen);
  if (maxLen === 0) return 1;
  return Math.min(aLen, bLen) / maxLen;
}

export function findBestMatch<T>(
  xtreamName: string,
  items: T[],
  nameOf: (item: T) => string,
  /**
   * Optional precomputed normalized candidate names (index-aligned with
   * `items`), so callers matching many targets against the same candidate list
   * normalize each candidate once overall instead of once per target.
   */
  normalizedNames?: string[],
): T | null {
  const target = normalizeChannelName(xtreamName);
  const targetLen = target.length;
  let best: T | null = null;
  let bestScore = 0;
  for (let i = 0; i < items.length; i++) {
    const candidate = normalizedNames ? normalizedNames[i] : normalizeChannelName(nameOf(items[i]));
    // Skip candidates that can't strictly beat the running best (nor reach the
    // acceptance threshold) on length grounds alone - the common case for most
    // of a large candidate list, and it avoids the Levenshtein DP entirely.
    const upperBound = lengthUpperBound(targetLen, candidate.length);
    if (upperBound <= bestScore || upperBound < MATCH_THRESHOLD) continue;
    const maxLen = Math.max(targetLen, candidate.length);
    const score = maxLen === 0 ? 1 : 1 - levenshtein(target, candidate) / maxLen;
    if (score > bestScore) {
      bestScore = score;
      best = items[i];
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

export function findBestStationMatch(
  xtreamName: string,
  stations: StellarStation[],
  normalizedNames?: string[],
): StellarStation | null {
  return findBestMatch(xtreamName, stations, (station) => station.name, normalizedNames);
}

/** The now-playing fields actually rendered by the channel cards / transport bar. */
function stationRenderEqual(a: StellarStation, b: StellarStation): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.artist === b.artist &&
    a.album === b.album &&
    a.cut_type === b.cut_type &&
    a.artwork_url === b.artwork_url
  );
}

/**
 * Builds the channel -> live-station now-playing map for one poll tick.
 *
 * The channel/station name match is stable (a channel doesn't change which
 * station it corresponds to between polls) while only the song/artist inside
 * a station changes - so `stationIdCache` remembers each channel's matched
 * `StellarStation.id` and this only re-runs the fuzzy match for channels that
 * aren't cached yet (first tick, or a channel whose station dropped out of the
 * current response), instead of re-matching every channel against every station
 * on every tick.
 *
 * When `prev` is supplied, each entry whose rendered fields are unchanged reuses
 * the previous `StellarStation` object identity, so a song change on one station
 * only gives a new object (and thus a new memo prop) to that one channel's card
 * rather than invalidating `React.memo` on every card.
 */
export function buildNowPlayingMap(
  channels: XtreamChannel[],
  stations: StellarStation[],
  stationIdCache: Map<number, string>,
  prev?: Map<number, StellarStation>,
): Map<number, StellarStation> {
  const stationsById = new Map(stations.map((station) => [station.id, station]));
  // Normalize each station name once for this tick (reused across every
  // uncached channel's fuzzy match below).
  let normalizedStationNames: string[] | undefined;
  const map = new Map<number, StellarStation>();
  for (const channel of channels) {
    const cachedId = stationIdCache.get(channel.stream_id);
    let station = cachedId ? stationsById.get(cachedId) : undefined;
    if (!station) {
      if (!normalizedStationNames) {
        normalizedStationNames = stations.map((s) => normalizeChannelName(s.name));
      }
      const match = findBestStationMatch(channel.name, stations, normalizedStationNames);
      if (!match) continue;
      station = match;
      stationIdCache.set(channel.stream_id, match.id);
    }
    const previous = prev?.get(channel.stream_id);
    map.set(channel.stream_id, previous && stationRenderEqual(previous, station) ? previous : station);
  }
  return map;
}

/**
 * Shallow content comparison for two now-playing maps (by the fields
 * actually rendered), so a poll tick that returned identical data can keep
 * the previous `Map` reference instead of forcing a re-render everywhere
 * `nowPlaying` is subscribed to.
 */
export function nowPlayingMapsEqual(
  a: Map<number, StellarStation>,
  b: Map<number, StellarStation>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [streamId, station] of b) {
    const prev = a.get(streamId);
    if (!prev || !stationRenderEqual(prev, station)) {
      return false;
    }
  }
  return true;
}

/**
 * Builds the channel -> Stellar-channel metadata map (logos/categories/etc).
 *
 * Like `buildNowPlayingMap`, the channel/Stellar-channel match is stable, so
 * `metadataIdCache` remembers each channel's matched `StellarChannel.id` and
 * only uncached channels run the O(len²) fuzzy match. The Stellar-channel names
 * are normalized once and reused across every uncached channel.
 */
export function buildChannelMetadataMap(
  channels: XtreamChannel[],
  stellarChannels: StellarChannel[],
  metadataIdCache?: Map<number, string>,
): Map<number, StellarChannel> {
  const byId = new Map(stellarChannels.map((c) => [c.id, c]));
  let normalizedNames: string[] | undefined;
  const map = new Map<number, StellarChannel>();
  for (const channel of channels) {
    const cachedId = metadataIdCache?.get(channel.stream_id);
    let match = cachedId ? byId.get(cachedId) : undefined;
    if (!match) {
      if (!normalizedNames) {
        normalizedNames = stellarChannels.map((c) => normalizeChannelName(c.marketing_name || c.name));
      }
      const found = findBestMatch(channel.name, stellarChannels, (c) => c.marketing_name || c.name, normalizedNames);
      if (!found) continue;
      match = found;
      metadataIdCache?.set(channel.stream_id, found.id);
    }
    map.set(channel.stream_id, match);
  }
  return map;
}
