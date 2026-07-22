import { describe, expect, it } from 'vitest';
import { buildNumericJumpGroups } from './channelJumpGroups';

describe('buildNumericJumpGroups', () => {
  it('uses decades when they fit', () => {
    expect(buildNumericJumpGroups([1, 9, 10, 29], 3)).toEqual([
      { label: '0', index: 0 },
      { label: '10', index: 2 },
      { label: '20', index: 3 },
    ]);
  });

  it('uses 20s for a longer channel list', () => {
    const numbers = Array.from({ length: 50 }, (_, index) => index * 10);
    const groups = buildNumericJumpGroups(numbers, 25);

    expect(groups).toHaveLength(25);
    expect(groups.slice(0, 3).map((group) => group.label)).toEqual(['0', '20', '40']);
  });

  it('uses 50s when 20s would still overfill the rail', () => {
    const numbers = Array.from({ length: 100 }, (_, index) => index * 10);
    const groups = buildNumericJumpGroups(numbers, 25);

    expect(groups).toHaveLength(20);
    expect(groups.slice(0, 3).map((group) => group.label)).toEqual(['0', '50', '100']);
  });

  it('continues to skip empty buckets', () => {
    expect(buildNumericJumpGroups([1, 2, 31, 32], 10)).toEqual([
      { label: '0', index: 0 },
      { label: '30', index: 2 },
    ]);
  });
});
