import { useEffect, useState, type RefObject } from 'react';

export interface JumpGroup {
  label: string;
  index: number;
}

interface JumpRailProps {
  groups: JumpGroup[];
  totalCount: number;
  containerRef: RefObject<HTMLDivElement | null>;
  /** Scrolls the (virtualized) list so the given item index is at the top. */
  onJump: (itemIndex: number) => void;
}

/**
 * Plex-style sticky index. Jumping delegates to the list virtualizer's
 * index-based scroll (`onJump`), which lands the target row at the top even
 * when it isn't currently mounted. The active-label highlight on scroll is a
 * proportional estimate, which is fine since it only needs to be approximately
 * right.
 */
export function JumpRail({ groups, totalCount, containerRef, onJump }: JumpRailProps) {
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
    // The list is virtualized, so the target item may not be in the DOM to
    // measure - defer to the virtualizer's own index-based scroll.
    onJump(group.index);
  }

  if (groups.length === 0) return null;

  return (
    <div
      style={{
        flex: 'none',
        width: 26,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
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
            lineHeight: '12px',
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
