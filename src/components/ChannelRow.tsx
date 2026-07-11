import { Avatar, Group, Text, UnstyledButton } from '@mantine/core';
import type { XtreamChannel } from '../types/xtream';
import type { StellarStation } from '../types/stellarTunerLog';

interface ChannelRowProps {
  channel: XtreamChannel;
  active: boolean;
  nowPlaying?: StellarStation;
  onSelect: (channel: XtreamChannel) => void;
}

export function ChannelRow({ channel, active, nowPlaying, onSelect }: ChannelRowProps) {
  return (
    <UnstyledButton
      onClick={() => onSelect(channel)}
      p="xs"
      style={{
        display: 'block',
        width: '100%',
        borderRadius: 6,
        backgroundColor: active ? 'var(--mantine-color-blue-light)' : undefined,
      }}
    >
      <Group wrap="nowrap" gap="sm">
        <Avatar src={channel.stream_icon} radius="sm" size="md">
          {channel.name.charAt(0)}
        </Avatar>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={500} truncate>
            {channel.num} · {channel.name}
          </Text>
          {nowPlaying && (
            <Text size="xs" c="dimmed" truncate>
              {nowPlaying.artist} — {nowPlaying.title}
            </Text>
          )}
        </div>
      </Group>
    </UnstyledButton>
  );
}
