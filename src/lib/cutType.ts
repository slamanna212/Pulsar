export interface CutTypeBadgeStyle {
  label: string;
  bg: string;
  color: string;
}

const SONG: CutTypeBadgeStyle = { label: 'Song', bg: 'rgba(18,184,134,.18)', color: '#3fdba0' };
const SPORTS: CutTypeBadgeStyle = { label: 'Sports', bg: 'rgba(247,103,7,.18)', color: '#ff9d52' };
const TALK: CutTypeBadgeStyle = { label: 'Talk', bg: 'rgba(51,154,240,.18)', color: '#66c3ff' };
const PROGRAM: CutTypeBadgeStyle = { label: 'Program', bg: 'rgba(92,124,250,.18)', color: '#a3b4ff' };
const EXPLICIT: CutTypeBadgeStyle = { label: 'Explicit', bg: 'rgba(250,82,82,.18)', color: '#ff8787' };
const SPOT: CutTypeBadgeStyle = { label: 'Spot', bg: 'rgba(252,196,25,.18)', color: '#ffd75e' };
const PROMO: CutTypeBadgeStyle = { label: 'Promo', bg: 'rgba(240,101,149,.18)', color: '#ffa3c0' };

/**
 * cut_type has a known typo variant in the wild ("PGM_Segement") that must
 * map to the same "Program" badge as the correctly-spelled value.
 */
export function getCutTypeBadge(rawCutType: string | null | undefined): CutTypeBadgeStyle | null {
  if (!rawCutType) return null;
  const normalized = rawCutType.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'song') return SONG;
  if (normalized === 'sports') return SPORTS;
  if (normalized === 'talk') return TALK;
  if (normalized === 'pgm_segment' || normalized === 'pgm_segement') return PROGRAM;
  if (normalized === 'exp') return EXPLICIT;
  if (normalized === 'spot') return SPOT;
  if (normalized === 'promo') return PROMO;
  if (normalized === 'link' || normalized === 'perm' || normalized === 'fill') {
    return { label: rawCutType.trim(), bg: 'rgba(255,255,255,.1)', color: 'var(--app-dim)' };
  }
  return null;
}
