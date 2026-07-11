import { getCutTypeBadge } from '../lib/cutType';

interface CutTypeBadgeProps {
  cutType: string | null | undefined;
}

export function CutTypeBadge({ cutType }: CutTypeBadgeProps) {
  const badge = getCutTypeBadge(cutType);
  if (!badge) return null;

  return (
    <div
      style={{
        flex: 'none',
        font: '700 11px "Space Grotesk", sans-serif',
        background: badge.bg,
        color: badge.color,
        borderRadius: 999,
        padding: '5px 12px',
        whiteSpace: 'nowrap',
      }}
    >
      {badge.label}
    </div>
  );
}
