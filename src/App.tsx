import { useEffect, useState } from 'react';
import { ActionIcon, AppShell, Group, MantineProvider, Text, Title } from '@mantine/core';
import { useSettingsStore } from './stores/settingsStore';
import { useChannelStore } from './stores/channelStore';
import { usePlayerStore } from './stores/playerStore';
import { ChannelList } from './components/ChannelList';
import { SettingsModal } from './components/SettingsModal';
import { NowPlayingPanel } from './components/NowPlayingPanel';
import { setMediaMetadata } from './lib/mediaSession';

function AppShellContent() {
  const { settings, loaded, load } = useSettingsStore();
  const { channels, status, error, fetchChannels, pollNowPlaying, nowPlaying } = useChannelStore();
  const { currentChannel, selectChannel, initEventListener } = usePlayerStore();
  const [settingsOpened, setSettingsOpened] = useState(false);

  useEffect(() => {
    load();
    initEventListener();
  }, [load, initEventListener]);

  useEffect(() => {
    if (loaded) {
      usePlayerStore.setState({ volume: settings.defaultVolume });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (loaded && settings.baseUrl && settings.username && settings.categoryId) {
      fetchChannels(
        { baseUrl: settings.baseUrl, username: settings.username, password: settings.password },
        settings.categoryId,
      );
    }
  }, [loaded, settings.baseUrl, settings.username, settings.password, settings.categoryId, fetchChannels]);

  useEffect(() => {
    if (!loaded || !settings.stellarApiKey || channels.length === 0) return;
    pollNowPlaying(settings.stellarApiKey);
    const id = setInterval(
      () => pollNowPlaying(settings.stellarApiKey),
      settings.pollIntervalSec * 1000,
    );
    return () => clearInterval(id);
  }, [loaded, settings.stellarApiKey, settings.pollIntervalSec, channels, pollNowPlaying]);

  const currentNowPlaying = currentChannel ? nowPlaying.get(currentChannel.stream_id) : undefined;

  useEffect(() => {
    if (!currentChannel) return;
    if (currentNowPlaying) {
      setMediaMetadata({
        title: currentNowPlaying.title,
        artist: currentNowPlaying.artist,
        album: currentNowPlaying.album || undefined,
        coverUrl: currentNowPlaying.artwork_url || currentChannel.stream_icon,
      });
    } else {
      setMediaMetadata({ title: currentChannel.name, artist: '', coverUrl: currentChannel.stream_icon });
    }
  }, [currentChannel, currentNowPlaying]);

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
          activeStreamId={currentChannel?.stream_id ?? null}
          nowPlaying={nowPlaying}
          onSelect={(channel) =>
            selectChannel(
              channel,
              { baseUrl: settings.baseUrl, username: settings.username, password: settings.password },
              settings.streamExtension,
            )
          }
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <NowPlayingPanel nowPlayingEntry={currentNowPlaying} />
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
