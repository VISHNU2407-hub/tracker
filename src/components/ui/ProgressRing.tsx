import React from 'react';

interface ProgressRingProps {
  /** 0..100, or null when no eligible habits exist */
  pct: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  /** Extra caption under the percentage, e.g. "of 90 days" */
  caption?: string;
  /** Overrides the automatic green / icy-blue coloring. */
  tone?: 'auto' | 'ice' | 'mint' | 'violet' | 'warm';
}

/* Circular completion indicator with a text label (never color-only). */
export function ProgressRing({
  pct, size = 96, stroke = 8, label = 'Today', caption, tone = 'auto',
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const p = pct ?? 0;
  const offset = circ * (1 - p / 100);

  const color =
    pct === null
      ? 'var(--text-faint)'
      : tone === 'mint'
        ? 'var(--success)'
        : tone === 'violet'
          ? 'var(--accent-2)'
          : tone === 'warm'
            ? 'var(--warning)'
            : p >= 100
              ? 'var(--success)'
              : 'var(--accent)';

  const gid = `ring-${React.useId().replace(/:/g, '')}`;

  return (
    <div
      className="progress-ring"
      role="img"
      aria-label={`${label}: ${pct === null ? 'no habits yet' : `${p}% complete`}`}
    >
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7cbcff" />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={tone === 'mint' ? '#27b587' : 'var(--accent-2)'} />
          </linearGradient>
        </defs>
        <circle
          className="progress-ring-track"
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={stroke} fill="none"
        />
        {pct !== null && pct > 0 && (
          <circle
            className="progress-ring-bar"
            cx={size / 2} cy={size / 2} r={radius}
            strokeWidth={stroke} fill="none"
            stroke={`url(#${gid})`}
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        )}
      </svg>
      <div className="progress-ring-label">
        <div className="pct" style={{ color }}>
          {pct === null ? '—' : `${p}%`}
        </div>
        <div className="lbl">{label}</div>
        {caption && <div className="cap">{caption}</div>}
      </div>
    </div>
  );
}