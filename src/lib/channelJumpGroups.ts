const NICE_INTERVAL_MULTIPLIERS = [1, 2, 5];

interface NumericJumpGroup {
  label: string;
  index: number;
}

function groupsForInterval(channelNumbers: number[], interval: number): NumericJumpGroup[] {
  const seen = new Set<number>();
  const groups: NumericJumpGroup[] = [];

  channelNumbers.forEach((channelNumber, index) => {
    const bucket = Math.floor(channelNumber / interval) * interval;
    if (seen.has(bucket)) return;

    seen.add(bucket);
    groups.push({ label: `${bucket}`, index });
  });

  return groups;
}

/**
 * Builds non-empty numeric jump buckets using the smallest readable interval
 * that fits the rail. Intervals progress in familiar steps: 10, 20, 50, 100…
 */
export function buildNumericJumpGroups(channelNumbers: number[], maxGroups: number): NumericJumpGroup[] {
  const groupLimit = Math.max(1, Math.floor(maxGroups));
  let magnitude = 10;

  for (;;) {
    for (const multiplier of NICE_INTERVAL_MULTIPLIERS) {
      const groups = groupsForInterval(channelNumbers, magnitude * multiplier);
      if (groups.length <= groupLimit) return groups;
    }

    magnitude *= 10;
  }
}
