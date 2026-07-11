import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  PasswordInput,
  Select,
  Slider,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useSettingsStore } from '../stores/settingsStore';
import { getLiveCategories } from '../lib/xtream';
import type { XtreamCategory } from '../types/xtream';

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [username, setUsername] = useState(settings.username);
  const [password, setPassword] = useState(settings.password);
  const [streamExtension, setStreamExtension] = useState(settings.streamExtension);
  const [stellarApiKey, setStellarApiKey] = useState(settings.stellarApiKey);
  const [pollIntervalSec, setPollIntervalSec] = useState(settings.pollIntervalSec);
  const [defaultVolume, setDefaultVolume] = useState(settings.defaultVolume);

  const [categories, setCategories] = useState<XtreamCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(settings.categoryId);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setBaseUrl(settings.baseUrl);
      setUsername(settings.username);
      setPassword(settings.password);
      setStreamExtension(settings.streamExtension);
      setStellarApiKey(settings.stellarApiKey);
      setPollIntervalSec(settings.pollIntervalSec);
      setDefaultVolume(settings.defaultVolume);
      setCategoryId(settings.categoryId);
      setTestStatus('idle');
      setTestError(null);
    }
  }, [opened, settings]);

  async function handleTestConnection() {
    setTestStatus('testing');
    setTestError(null);
    try {
      const cats = await getLiveCategories({ baseUrl, username, password });
      setCategories(cats);
      setTestStatus('ok');
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSave() {
    const category = categories.find((c) => c.category_id === categoryId);
    await update({
      baseUrl,
      username,
      password,
      streamExtension,
      stellarApiKey,
      pollIntervalSec,
      defaultVolume,
      categoryId,
      categoryName: category?.category_name ?? settings.categoryName,
    });
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Settings" size="md">
      <Stack>
        <TextInput
          label="Xtream base URL"
          placeholder="http://host:port"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.currentTarget.value)}
        />
        <TextInput
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
        />
        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />

        <Group>
          <Button onClick={handleTestConnection} loading={testStatus === 'testing'}>
            Test Connection
          </Button>
          {testStatus === 'ok' && (
            <Text c="teal" size="sm">
              Connected — {categories.length} categories found
            </Text>
          )}
        </Group>
        {testStatus === 'error' && (
          <Alert color="red" title="Connection failed">
            {testError}
          </Alert>
        )}

        <Select
          label="Channel group"
          placeholder="Run Test Connection to load groups"
          data={categories.map((c) => ({ value: c.category_id, label: c.category_name }))}
          value={categoryId}
          onChange={setCategoryId}
          disabled={categories.length === 0}
          searchable
        />

        <Select
          label="Stream extension"
          data={['.ts', '.m3u8']}
          value={streamExtension}
          onChange={(v) => setStreamExtension(v ?? '.ts')}
        />

        <TextInput
          label="StellarTunerLog API key"
          value={stellarApiKey}
          onChange={(e) => setStellarApiKey(e.currentTarget.value)}
        />

        <NumberInput
          label="StellarTunerLog poll interval (seconds)"
          min={5}
          max={300}
          value={pollIntervalSec}
          onChange={(v) => setPollIntervalSec(typeof v === 'number' ? v : 25)}
        />

        <div>
          <Text size="sm" fw={500} mb={4}>
            Default volume
          </Text>
          <Slider value={defaultVolume} onChange={setDefaultVolume} min={0} max={100} label={(v) => `${v}%`} />
        </div>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!categoryId}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
