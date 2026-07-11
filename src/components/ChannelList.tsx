import { Alert, Center, Loader, ScrollArea, Stack, Text } from '@mantine/core';
import type { XtreamChannel } from '../types/xtream';
import { ChannelRow } from './ChannelRow';

interface ChannelListProps {
  channels: XtreamChannel[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
  activeStreamId: number | null;
  onSelect: (channel: XtreamChannel) => void;
}

export function ChannelList({ channels, status, error, activeStreamId, onSelect }: ChannelListProps) {
  if (status === 'idle') {
    return (
      <Text c="dimmed" size="sm">
        Configure Settings and pick a channel group to load channels.
      </Text>
    );
  }

  if (status === 'loading') {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  if (status === 'error') {
    return (
      <Alert color="red" title="Failed to load channels">
        {error}
      </Alert>
    );
  }

  return (
    <ScrollArea h="calc(100vh - 140px)">
      <Stack gap={2}>
        {channels.map((channel) => (
          <ChannelRow
            key={channel.stream_id}
            channel={channel}
            active={channel.stream_id === activeStreamId}
            onSelect={onSelect}
          />
        ))}
      </Stack>
    </ScrollArea>
  );
}
