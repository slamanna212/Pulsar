import { useState } from 'react';
import { Alert, Button, Group, Text, TextInput } from '@mantine/core';
import type { Settings } from '../../stores/settingsStore';
import { getChannels, getHistory } from '../../lib/stellarTunerLog';
import { OnboardingCard } from './OnboardingCard';

interface StellarApiScreenProps {
  settings: Settings;
  onBack: () => void;
  onSkip: (patch: Partial<Settings>) => void;
  onNext: (patch: Partial<Settings>) => void;
}

export function StellarApiScreen({ settings, onBack, onSkip, onNext }: StellarApiScreenProps) {
  const [stellarApiKey, setStellarApiKey] = useState(settings.stellarApiKey);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  async function handleTestKey() {
    setTestStatus('testing');
    setTestError(null);
    try {
      const channels = await getChannels();
      const sample = channels[0];
      if (!sample) {
        throw new Error('No channels available to test against right now.');
      }
      await getHistory(sample.id, stellarApiKey);
      setTestStatus('ok');
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 520 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ font: '700 22px "Space Grotesk", sans-serif', marginBottom: 6 }}>See play history</div>
        <Text size="sm" c="dimmed">
          Apogee shows live song and artist info for every channel automatically — no API key needed. A
          StellarTunerLog API key unlocks one more thing: the "recently played" history list on each channel's
          detail page. This step is optional — you can always add a key later from Settings.
        </Text>
      </div>

      <OnboardingCard title="StellarTunerLog API">
        <TextInput
          label="API key"
          placeholder="Paste your API key"
          value={stellarApiKey}
          onChange={(e) => setStellarApiKey(e.currentTarget.value)}
        />
        <Group align="center">
          <Button onClick={handleTestKey} loading={testStatus === 'testing'} disabled={!stellarApiKey}>
            Test key
          </Button>
          {testStatus === 'ok' && (
            <Text c="teal" size="sm">
              Connected
            </Text>
          )}
        </Group>
        {testStatus === 'error' && (
          <Alert color="red" title="Couldn't connect">
            {testError}
          </Alert>
        )}
      </OnboardingCard>

      <Group justify="space-between" w="100%" mt={4}>
        <Button variant="subtle" onClick={onBack}>
          Back
        </Button>
        <Group>
          <Button variant="subtle" onClick={() => onSkip({ stellarApiKey: '' })}>
            Skip for now
          </Button>
          <Button onClick={() => onNext({ stellarApiKey })}>Next</Button>
        </Group>
      </Group>
    </div>
  );
}
