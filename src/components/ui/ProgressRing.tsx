import React from 'react';

interface ProgressRingProps {
  /** 0..100, or null when no eligible habits exist */
  pct: number | null;
  size?: number;
  stroke?: number;
  label?: string;
}

/** Circular completion indicator with text label (not color-only, spec §10). */
export function ProgressRing({ pct, size = 96, stroke = 8, label = 'Today' }: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const p = pct ?? 0;
  const offset = circ * (1 - p / 100);
  const color = pct === null ? 'var(--text-muted)' : p >= 100 ? 'var(--success)' : 'var(--accent)';

  return (
    <div className="progress-ring" role="img" aria-label={`${label}: ${pct === null ? 'no habits yet' : `${p}% complete`}`}>
      <svg width={size} height={size}>
        <circle className="progress-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="progress-ring-bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="progress-ring-label">
        <div className="pct" style={{ color }}>
          {pct === null ? '—' : `${p}%`}
        </div>
        <div className="lbl">{label}</div>
      </div>
    </div>
  );
}
