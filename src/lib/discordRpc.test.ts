import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { StellarStation } from '../types/stellarTunerLog';
import type { XtreamChannel } from '../types/xtream';
import {
  discordRpcClearActivity,
  discordRpcSetActivity,
  resolveDiscordActivity,
} from './discordRpc';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const channel: XtreamChannel = {
  stream_id: 1,
  name: 'Channel',
  stream_icon: 'channel.png',
  num: 1,
  category_id: '1',
};

const track: StellarStation = {
  id: 'station',
  name: 'Channel',
  channel_number: 1,
  artist: 'Artist',
  title: 'Song',
  album: 'Album',
  cut_type: 'Song',
  artwork_url: 'artwork.png',
  itunes_id: '',
};

describe('resolveDiscordActivity', () => {
  it('uses track metadata during confirmed playback', () => {
    expect(resolveDiscordActivity('playing', channel, track)).toEqual({
      details: 'Song',
      state: 'Artist',
      largeImageUrl: 'artwork.png',
      largeText: 'Channel',
    });
  });

  it('falls back to channel metadata when no track is matched', () => {
    expect(resolveDiscordActivity('playing', channel)).toEqual({
      details: 'Channel',
      largeImageUrl: 'channel.png',
      largeText: 'Channel',
    });
  });

  it.each(['idle', 'loading', 'stopped', 'error'] as const)(
    'returns no activity while playback is %s',
    (status) => {
      expect(resolveDiscordActivity(status, channel, track)).toBeNull();
    },
  );

  it('does not republish changed metadata after playback stops', () => {
    expect(resolveDiscordActivity('stopped', channel, { ...track, title: 'Next Song' })).toBeNull();
  });
});

describe('Discord RPC ordering', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('does not let an earlier activity update overtake a later clear', async () => {
    let finishSet: (() => void) | undefined;
    const pendingSet = new Promise<void>((resolve) => {
      finishSet = resolve;
    });
    vi.mocked(invoke)
      .mockImplementationOnce(() => pendingSet)
      .mockResolvedValueOnce(undefined);

    const setPromise = discordRpcSetActivity({ details: 'Song' });
    const clearPromise = discordRpcClearActivity();

    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenNthCalledWith(1, 'discord_rpc_set_activity', {
      details: 'Song',
      activityState: null,
      largeImageUrl: null,
      largeText: null,
    });

    finishSet?.();
    await Promise.all([setPromise, clearPromise]);
    expect(invoke).toHaveBeenNthCalledWith(2, 'discord_rpc_clear_activity');
  });
});
