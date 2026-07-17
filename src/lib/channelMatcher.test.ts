import { describe, expect, it } from 'vitest';
import type { XtreamChannel } from '../types/xtream';
import type { StellarChannel, StellarStation } from '../types/stellarTunerLog';
import {
  MATCH_THRESHOLD,
  buildChannelMetadataMap,
  buildNowPlayingMap,
  findBestStationMatch,
  nameSimilarity,
  normalizeChannelName,
  nowPlayingMapsEqual,
} from './channelMatcher';

function channel(streamId: number, name: string): XtreamChannel {
  return { stream_id: streamId, name, stream_icon: '', num: streamId, category_id: '1' };
}

function station(overrides: Partial<StellarStation> = {}): StellarStation {
  return {
    id: 'station',
    name: 'Octane',
    channel_number: 37,
    artist: 'Artist',
    title: 'Title',
    album: 'Album',
    cut_type: 'Song',
    artwork_url: 'art.png',
    itunes_id: '',
    ...overrides,
  };
}

function stellarChannel(overrides: Partial<StellarChannel> = {}): StellarChannel {
  return {
    id: 'chan',
    name: 'Octane',
    marketing_name: 'Octane',
    channel_number: 37,
    categories: [],
    ...overrides,
  };
}

describe('normalizeChannelName', () => {
  it('strips the Radio: prefix, a leading The, and HD/Radio suffixes', () => {
    expect(normalizeChannelName('Radio: The Pulse HD')).toBe('pulse');
    expect(normalizeChannelName('Elvis Radio')).toBe('elvis');
    expect(normalizeChannelName('The Beatles Channel')).toBe('beatleschannel');
  });

  it('drops punctuation and whitespace so formatting differences do not matter', () => {
    expect(normalizeChannelName("70s on 7")).toBe('70son7');
    expect(normalizeChannelName('Hits 1')).toBe(normalizeChannelName('HITS-1'));
  });

  it('only strips Radio as a suffix or a "Radio:" prefix, not mid-name', () => {
    expect(normalizeChannelName('Radio Margaritaville')).toBe('radiomargaritaville');
  });
});

describe('nameSimilarity', () => {
  it('returns 1 for identical and 1 for two empty strings', () => {
    expect(nameSimilarity('octane', 'octane')).toBe(1);
    expect(nameSimilarity('', '')).toBe(1);
  });

  it('scales with edit distance over the longer length', () => {
    // one edit over length 6
    expect(nameSimilarity('octane', 'octant')).toBeCloseTo(1 - 1 / 6);
    expect(nameSimilarity('octane', 'zzzzzz')).toBe(0);
  });

  it('is symmetric', () => {
    expect(nameSimilarity('abc', 'abcd')).toBe(nameSimilarity('abcd', 'abc'));
  });
});

describe('findBestStationMatch', () => {
  const stations = [
    station({ id: 'octane', name: 'Octane' }),
    station({ id: 'pulse', name: 'The Pulse' }),
    station({ id: 'liquid', name: 'Liquid Metal' }),
  ];

  it('matches despite prefix/suffix and formatting noise', () => {
    expect(findBestStationMatch('Radio: The Pulse HD', stations)?.id).toBe('pulse');
    expect(findBestStationMatch('OCTANE', stations)?.id).toBe('octane');
  });

  it('returns null when the best score is below the threshold', () => {
    expect(findBestStationMatch('Willie’s Roadhouse', stations)).toBeNull();
  });

  it('picks the highest-scoring station, not the first acceptable one', () => {
    const close = [
      station({ id: 'near', name: 'Octanes' }),
      station({ id: 'exact', name: 'Octane' }),
    ];
    expect(findBestStationMatch('Octane', close)?.id).toBe('exact');
  });

  it('enforces the documented threshold at the boundary', () => {
    // "octanee" vs "octane": 1 edit / 7 chars ≈ 0.857 >= 0.85
    expect(nameSimilarity('octane', 'octanee')).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    expect(findBestStationMatch('Octanee', [station({ id: 'o', name: 'Octane' })])?.id).toBe('o');
  });
});

describe('buildNowPlayingMap', () => {
  it('matches channels to stations and populates the cache', () => {
    const cache = new Map<number, string>();
    const map = buildNowPlayingMap(
      [channel(1, 'Octane'), channel(2, 'Nowhere FM')],
      [station({ id: 's1', name: 'Octane' })],
      cache,
    );
    expect(map.get(1)?.id).toBe('s1');
    expect(map.has(2)).toBe(false);
    expect(cache.get(1)).toBe('s1');
    expect(cache.has(2)).toBe(false);
  });

  it('uses the cached station id without re-running the fuzzy match', () => {
    const cache = new Map<number, string>([[1, 's1']]);
    // Renamed beyond any fuzzy match - only the cached id can link these.
    const map = buildNowPlayingMap(
      [channel(1, 'Octane')],
      [station({ id: 's1', name: 'Completely Different Name', title: 'Fresh Song' })],
      cache,
    );
    expect(map.get(1)?.title).toBe('Fresh Song');
  });

  it('re-matches when the cached station drops out of the response', () => {
    const cache = new Map<number, string>([[1, 'gone']]);
    const map = buildNowPlayingMap(
      [channel(1, 'Octane')],
      [station({ id: 's2', name: 'Octane' })],
      cache,
    );
    expect(map.get(1)?.id).toBe('s2');
    expect(cache.get(1)).toBe('s2');
  });

  it('omits a channel whose cached station is gone and no longer matches anything', () => {
    const cache = new Map<number, string>([[1, 'gone']]);
    const map = buildNowPlayingMap(
      [channel(1, 'Octane')],
      [station({ id: 's3', name: 'Liquid Metal' })],
      cache,
    );
    expect(map.has(1)).toBe(false);
  });

  it('reuses the previous station object identity when rendered fields are unchanged', () => {
    const cache = new Map<number, string>([[1, 's1']]);
    const prevStation = station({ id: 's1', title: 'Same Song' });
    const prev = new Map([[1, prevStation]]);
    // A fresh response object with identical rendered fields (different object identity).
    const next = buildNowPlayingMap(
      [channel(1, 'Octane')],
      [station({ id: 's1', title: 'Same Song' })],
      cache,
      prev,
    );
    expect(next.get(1)).toBe(prevStation);
  });

  it('gives a new station object only to the channel whose track changed', () => {
    const cache = new Map<number, string>([[1, 's1'], [2, 's2']]);
    const s1Prev = station({ id: 's1', title: 'A' });
    const s2Prev = station({ id: 's2', title: 'B' });
    const prev = new Map([[1, s1Prev], [2, s2Prev]]);
    const next = buildNowPlayingMap(
      [channel(1, 'One'), channel(2, 'Two')],
      [station({ id: 's1', title: 'A' }), station({ id: 's2', title: 'B2' })],
      cache,
      prev,
    );
    // channel 1 unchanged -> reused identity; channel 2 changed -> new object
    expect(next.get(1)).toBe(s1Prev);
    expect(next.get(2)).not.toBe(s2Prev);
    expect(next.get(2)?.title).toBe('B2');
  });
});

describe('nowPlayingMapsEqual', () => {
  const base = () => new Map([[1, station({ id: 's1' })]]);

  it('treats maps with identical rendered fields as equal', () => {
    expect(nowPlayingMapsEqual(base(), base())).toBe(true);
  });

  it('detects a changed track on the same station', () => {
    const next = new Map([[1, station({ id: 's1', title: 'Other' })]]);
    expect(nowPlayingMapsEqual(base(), next)).toBe(false);
  });

  it('detects size changes and missing entries', () => {
    expect(nowPlayingMapsEqual(base(), new Map())).toBe(false);
    const next = new Map([[2, station({ id: 's1' })]]);
    expect(nowPlayingMapsEqual(base(), next)).toBe(false);
  });

  it('ignores fields that are not rendered', () => {
    const next = new Map([[1, station({ id: 's1', itunes_id: 'different' })]]);
    expect(nowPlayingMapsEqual(base(), next)).toBe(true);
  });
});

describe('buildChannelMetadataMap', () => {
  it('matches on marketing_name when present, falling back to name', () => {
    const byMarketing = stellarChannel({ id: 'a', name: 'internal-a', marketing_name: 'Octane' });
    const byName = stellarChannel({ id: 'b', name: 'The Pulse', marketing_name: '' });
    const map = buildChannelMetadataMap(
      [channel(1, 'Octane'), channel(2, 'The Pulse')],
      [byMarketing, byName],
    );
    expect(map.get(1)?.id).toBe('a');
    expect(map.get(2)?.id).toBe('b');
  });

  it('leaves unmatched channels out of the map', () => {
    const map = buildChannelMetadataMap([channel(1, 'Nowhere FM')], [stellarChannel()]);
    expect(map.size).toBe(0);
  });

  it('uses the cached id without re-running the fuzzy match', () => {
    const cache = new Map<number, string>([[1, 'cached']]);
    // Renamed beyond any fuzzy match - only the cached id can link these.
    const map = buildChannelMetadataMap(
      [channel(1, 'Octane')],
      [stellarChannel({ id: 'cached', name: 'Completely Different', marketing_name: 'Completely Different' })],
      cache,
    );
    expect(map.get(1)?.id).toBe('cached');
  });

  it('populates the cache on a fresh match', () => {
    const cache = new Map<number, string>();
    buildChannelMetadataMap([channel(1, 'Octane')], [stellarChannel({ id: 'a', marketing_name: 'Octane' })], cache);
    expect(cache.get(1)).toBe('a');
  });
});
