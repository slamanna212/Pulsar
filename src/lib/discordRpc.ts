import { invoke } from '@tauri-apps/api/core';
import type { PlayerStatus } from '../types/player';
import type { StellarStation } from '../types/stellarTunerLog';
import type { XtreamChannel } from '../types/xtream';

export interface DiscordActivity {
  details: string;
  state?: string;
  largeImageUrl?: string;
  largeText?: string;
}

let rpcQueue: Promise<void> = Promise.resolve();

function enqueueRpc(operation: () => Promise<void>): Promise<void> {
  const result = rpcQueue.then(operation, operation);
  rpcQueue = result.catch(() => {});
  return result.catch(() => {});
}

export function resolveDiscordActivity(
  status: PlayerStatus,
  channel: XtreamChannel | null,
  nowPlaying?: StellarStation,
): DiscordActivity | null {
  if (status !== 'playing' || !channel) return null;

  if (nowPlaying) {
    return {
      details: nowPlaying.title,
      state: nowPlaying.artist,
      largeImageUrl: nowPlaying.artwork_url || channel.stream_icon,
      largeText: channel.name,
    };
  }

  return {
    details: channel.name,
    largeImageUrl: channel.stream_icon,
    largeText: channel.name,
  };
}

// Discord not running is expected steady-state for this opt-in feature, not
// an error worth surfacing - same posture as channelStore's transient
// StellarTunerLog fetch failures.

export function discordRpcConnect(): Promise<void> {
  return enqueueRpc(() => invoke<void>('discord_rpc_connect'));
}

export function discordRpcSetActivity(activity: DiscordActivity): Promise<void> {
  return enqueueRpc(() => invoke<void>('discord_rpc_set_activity', {
    details: activity.details,
    activityState: activity.state ?? null,
    largeImageUrl: activity.largeImageUrl ?? null,
    largeText: activity.largeText ?? null,
  }));
}

export function discordRpcClearActivity(): Promise<void> {
  return enqueueRpc(() => invoke<void>('discord_rpc_clear_activity'));
}

export function discordRpcDisconnect(): Promise<void> {
  return enqueueRpc(() => invoke<void>('discord_rpc_disconnect'));
}
