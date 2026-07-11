import { useEffect, useState } from 'react';
import { ActionIcon, AppShell, Group, MantineProvider, Text, Title } from '@mantine/core';
import { useSettingsStore } from './stores/settingsStore';
import { useChannelStore } from './stores/channelStore';
import { ChannelList } from './components/ChannelList';
import { SettingsModal } from './components/SettingsModal';
import type { XtreamChannel } from './types/xtream';

function AppShellContent() {
  const { settings, loaded, load } = useSettingsStore();
  const { channels, status, error, fetchChannels } = useChannelStore();
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [activeChannel, setActiveChannel] = useState<XtreamChannel | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loaded && settings.baseUrl && settings.username && settings.categoryId) {
      fetchChannels(
        { baseUrl: settings.baseUrl, username: settings.username, password: settings.password },
        settings.categoryId,
      );
    }
  }, [loaded, settings.baseUrl, settings.username, settings.password, settings.categoryId, fetchChannels]);

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 320, breakpoint: 'sm' }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Pulsar</Title>
          <ActionIcon variant="subtle" onClick={() => setSettingsOpened(true)} aria-label="Settings">
            ⚙
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Text fw={600} mb="sm">
          {settings.categoryName ?? 'Channels'}
        </Text>
        <ChannelList
          channels={channels}
          status={status}
          error={error}
          activeStreamId={activeChannel?.stream_id ?? null}
          onSelect={setActiveChannel}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        {activeChannel ? (
          <Text>{activeChannel.name}</Text>
        ) : (
          <Text c="dimmed">Now-playing panel and transport controls will render here.</Text>
        )}
      </AppShell.Main>

      <SettingsModal opened={settingsOpened} onClose={() => setSettingsOpened(false)} />
    </AppShell>
  );
}

function App() {
  return (
    <MantineProvider defaultColorScheme="dark">
      <AppShellContent />
    </MantineProvider>
  );
}

export default App;
