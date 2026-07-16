import { Button, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { invoke } from '@tauri-apps/api/core';
import { error as logError } from '@tauri-apps/plugin-log';
import type { AlertEntry } from '../types/alerts';
import type { StellarStation } from '../types/stellarTunerLog';

/** Requests OS notification permission if not already decided. Safe to call repeatedly. */
export async function ensureOSPermission(): Promise<boolean> {
  try {
    return await invoke<boolean>('ensure_os_notification_permission');
  } catch (error) {
    await logError(`Could not request OS notification permission: ${error}`);
    return false;
  }
}

export async function fireAlert(
  entry: AlertEntry,
  station: StellarStation,
  streamId: number,
  channelName: string,
  artworkUrl: string | undefined,
  notifyOS: boolean,
  notifyInApp: boolean,
  onGoToChannel?: (streamId: number) => void,
) {
  const title = entry.type === 'artist' ? `${station.artist} — now on ${channelName}` : `${station.title} is playing`;
  const body = entry.type === 'artist' ? station.title : `${station.artist} • ${channelName}`;

  if (notifyInApp) {
    const id = `alert-${streamId}-${Date.now()}`;
    notifications.show({
      id,
      title,
      autoClose: 8000,
      message: (
        <Group gap={8} wrap="nowrap" justify="space-between" align="center">
          <Text size="sm">{body}</Text>
          {onGoToChannel && (
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                onGoToChannel(streamId);
                notifications.hide(id);
              }}
            >
              Tune
            </Button>
          )}
        </Group>
      ),
    });
  }
  if (notifyOS && (await ensureOSPermission())) {
    void invoke('send_os_notification', { title, body, streamId, artworkUrl }).catch((e) =>
      logError(`OS notification failed: ${e}`),
    );
  }
}
