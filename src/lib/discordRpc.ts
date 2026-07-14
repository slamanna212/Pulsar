import { invoke } from '@tauri-apps/api/core';

export interface DiscordActivity {
  details: string;
  state?: string;
  largeImageUrl?: string;
  largeText?: string;
}

// Discord not running is expected steady-state for this opt-in feature, not
// an error worth surfacing - same posture as channelStore's transient
// StellarTunerLog fetch failures.

export function discordRpcConnect(): Promise<void> {
  return invoke<void>('discord_rpc_connect').catch(() => {});
}

export function discordRpcSetActivity(activity: DiscordActivity): Promise<void> {
  return invoke<void>('discord_rpc_set_activity', {
    details: activity.details,
    activityState: activity.state ?? null,
    largeImageUrl: activity.largeImageUrl ?? null,
    largeText: activity.largeText ?? null,
  }).catch(() => {});
}

export function discordRpcClearActivity(): Promise<void> {
  return invoke<void>('discord_rpc_clear_activity').catch(() => {});
}

export function discordRpcDisconnect(): Promise<void> {
  return invoke<void>('discord_rpc_disconnect').catch(() => {});
}
