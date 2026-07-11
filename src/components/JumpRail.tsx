import { useEffect, useState, type RefObject } from 'react';

export interface JumpGroup {
  label: string;
  index: number;
}

interface JumpRailProps {
  groups: JumpGroup[];
  totalCount: number;
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Plex-style sticky index: jumps are estimated proportionally against scroll
 * height (there are no per-group DOM anchors in the grid), which is close
 * enough for "jump to roughly here" behavior on a plain uniform grid.
 */
export function JumpRail({ groups, totalCount, containerRef }: JumpRailProps) {
  const [active, setActive] = useState(groups[0]?.label);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || groups.length === 0) return;

    function handleScroll() {
      if (!el) return;
      const scrollable = el.scrollHeight - el.clientHeight;
      const ratio = scrollable > 0 ? el.scrollTop / scrollable : 0;
      const approxIndex = Math.round(ratio * totalCount);
      let current = groups[0];
      for (const g of groups) {
        if (g.index <= approxIndex) current = g;
      }
      setActive(current.label);
    }
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [groups, totalCount, containerRef]);

  function jumpTo(group: JumpGroup) {
    const el = containerRef.current;
    if (!el) return;
    const ratio = totalCount > 0 ? group.index / totalCount : 0;
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  }

  if (groups.length === 0) return null;

  return (
    <div
      style={{
        flex: 'none',
        width: 26,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        paddingTop: 4,
        overflow: 'hidden',
      }}
    >
      {groups.map((g) => (
        <div
          key={g.label}
          onClick={() => jumpTo(g)}
          role="button"
          style={{
            font: '700 10px "Space Grotesk", sans-serif',
            color: active === g.label ? 'var(--app-accent2)' : 'var(--app-dim2)',
            cursor: 'pointer',
          }}
        >
          {g.label}
        </div>
      ))}
    </div>
  );
}
