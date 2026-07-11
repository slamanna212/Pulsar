import { invoke } from '@tauri-apps/api/core';

export function setSecret(key: string, value: string): Promise<void> {
  return invoke('secrets_set', { key, value });
}

export function getSecret(key: string): Promise<string | null> {
  return invoke('secrets_get', { key });
}

export function deleteSecret(key: string): Promise<void> {
  return invoke('secrets_delete', { key });
}

export const SECRET_KEYS = {
  xtreamPassword: 'xtream_password',
  stellarApiKey: 'stellar_api_key',
} as const;
