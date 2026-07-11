import { useState } from 'react';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import type { XtreamChannel } from '../types/xtream';
import type { StellarChannel } from '../types/stellarTunerLog';

const GRADIENTS: [string, string][] = [
  ['#ff7a5c', '#8b6bff'],
  ['#45e0d8', '#5c7cfa'],
  ['#f76707', '#f06595'],
  ['#12b886', '#339af0'],
  ['#5c7cfa', '#8b6bff'],
  ['#9775fa', '#f06595'],
  ['#fcc419', '#f76707'],
  ['#339af0', '#12b886'],
];

function hashGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const [a, b] = GRADIENTS[Math.abs(hash) % GRADIENTS.length];
  return `linear-gradient(150deg, ${a}, ${b})`;
}

interface ChannelCardProps {
  channel: XtreamChannel;
  metadata?: StellarChannel;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}

export function ChannelCard({ channel, metadata, isFavorite, onToggleFavorite, onClick }: ChannelCardProps) {
  const [hovered, setHovered] = useState(false);
  const name = metadata?.marketing_name || channel.name;
  const number = metadata?.channel_number ?? channel.num;
  const logoUrl = metadata?.logos?.color_dark_square || channel.stream_icon;
  const background = metadata?.dark_bg_color || hashGradient(channel.name);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      role="button"
      style={{
        position: 'relative',
        aspectRatio: '1',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        background,
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered ? '0 8px 24px var(--app-accent-soft)' : 'none',
        transition: 'transform 150ms, box-shadow 150ms',
      }}
    >
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(18px)',
            transform: 'scale(1.2)',
            opacity: 0.9,
          }}
        />
      )}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        role="button"
        aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'rgba(7,6,13,.55)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          opacity: isFavorite || hovered ? 1 : 0,
          transition: 'opacity 150ms',
        }}
      >
        {isFavorite ? <IconStarFilled size={14} /> : <IconStar size={14} />}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 10,
          background: 'linear-gradient(0deg, rgba(0,0,0,.55), transparent)',
          font: '600 12px "Space Grotesk", sans-serif',
          color: '#fff',
        }}
      >
        {name} <span style={{ opacity: 0.6, fontWeight: 400 }}>{number}</span>
      </div>
    </div>
  );
}
