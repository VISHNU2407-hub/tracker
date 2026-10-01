import React, { useMemo, useRef, useState } from 'react';
import { formatShort } from '../../services/date';

/* ============================================================
   Charts — dependency-free SVG charts that each answer one
   clear question. Pure presentation: data is passed in, never
   derived or stored here.

   LineChart → "Your completion trend"
   BarChart  → "Completion by week / by habit"
   ============================================================ */

const ACCENT = '#4f6ef7';
const ACCENT_SOFT = '#c7d3fd';
const GRID = '#e9edf5';
const MUTED = '#8894ab';

export interface ChartPoint {
  /** ISO date (yyyy-mm-dd) or any short label */
  label: string;
  /** Value 0..100, or null = no data (renders as a gap / placeholder bar) */
  value: number | null;
  /** Optional secondary line, e.g. 7-day rolling average (LineChart only) */
  sub?: number | null;
}

interface Tooltip {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

/* ------------------------------------------------------------
   LineChart — clean trend line with soft area fill, dotted
   baseline grid, optional rolling-average companion line.
   ------------------------------------------------------------ */

export function LineChart({
  points,
  height = 190,
  suffix = '%',
  ariaLabel,
}: {
  points: ChartPoint[];
  height?: number;
  suffix?: string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tooltip | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 720;
  const H = height;
  const PAD_L = 34;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 24;

  const hasData = points.some((p) => p.value !== null);

  const geo = useMemo(() => {
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const x = (i: number) =>
      PAD_L + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD_T + innerH - (v / 100) * innerH;

    const valPts = points
      .map((p, i) => ({ i, v: p.value }))
      .filter((p): p is { i: number; v: number } => p.v !== null);

    const segments: { i: number; v: number }[][] = [];
    let current: { i: number; v: number }[] = [];
    for (const p of valPts) {
      if (current.length === 0 || p.i === current[current.length - 1].i + 1) {
        current.push(p);
      } else {
        if (current.length > 0) segments.push(current);
        current = [p];
      }
    }
    if (current.length > 0) segments.push(current);

    const linePath = (pts: { i: number; v: number }[]) =>
      pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

    const mainPaths = segments
      .filter((s) => s.length > 1)
      .map((s) => linePath(s));
    const areaPaths = segments
      .filter((s) => s.length > 1)
      .map((s) => {
        const base = PAD_T + innerH;
        return (
          linePath(s) +
          `L${x(s[s.length - 1].i).toFixed(1)},${base}L${x(s[0].i).toFixed(1)},${base}Z`
        );
      });

    const subPts = points
      .map((p, i) => ({ i, v: p.sub ?? null }))
      .filter((p): p is { i: number; v: number } => p.v !== null && p.v !== undefined);
    const subPath =
      subPts.length > 1
        ? subPts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
        : null;

    const dots = valPts.length <= 31 ? valPts : [];

    return { x, y, linePaths: mainPaths, areaPaths, subPath, dots, innerH };
  }, [points, H]);

  if (!hasData) {
    return (
      <div className="chart-empty" role="img" aria-label={ariaLabel ?? 'No data yet'}>
        No tracked days in this range yet — your trend appears as you log habits.
      </div>
    );
  }

  const showTip = (i: number) => {
    const p = points[i];
    if (!wrapRef.current || !p) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const sx = rect.width / W;
    setTip({
      x: rect.left + geo.x(i) * sx,
      y: rect.top + geo.y(p.value ?? 0) * (rect.height / H),
      title: formatShort(p.label),
      lines: [
        p.value === null ? 'No habits eligible' : `${p.value}${suffix}`,
        ...(p.sub !== null && p.sub !== undefined ? [`7-day avg ${p.sub}${suffix}`] : []),
      ],
    });
    setHoverIdx(i);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => { setTip(null); setHoverIdx(null); }}
      >
        {/* horizontal gridlines */}
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={geo.y(v)} y2={geo.y(v)} stroke={GRID} strokeWidth={1} />
            <text x={PAD_L - 7} y={geo.y(v) + 3.5} textAnchor="end" fontSize={10} fill={MUTED}>
              {v}
            </text>
          </g>
        ))}

        {/* area fills */}
        {geo.areaPaths.map((d, k) => (
          <path key={k} d={d} fill={ACCENT} opacity={0.07} />
        ))}

        {/* main line(s) */}
        {geo.linePaths.map((d, k) => (
          <path
            key={k}
            d={d}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* rolling-average companion */}
        {geo.subPath && (
          <path
            d={geo.subPath}
            fill="none"
            stroke={ACCENT_SOFT}
            strokeWidth={1.8}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        )}

        {/* dots (sparse ranges only) */}
        {geo.dots.map((p) => (
          <circle
            key={p.i}
            cx={geo.x(p.i)}
            cy={geo.y(p.v)}
            r={hoverIdx === p.i ? 4.5 : 2.6}
            fill="#ffffff"
            stroke={ACCENT}
            strokeWidth={2}
          />
        ))}

        {/* hover targets — full-height columns */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={geo.x(i) - (W - PAD_L - PAD_R) / (2 * Math.max(1, points.length - 1))}
            y={PAD_T}
            width={(W - PAD_L - PAD_R) / Math.max(1, points.length - 1)}
            height={H - PAD_T - PAD_B}
            fill="transparent"
            onMouseEnter={() => showTip(i)}
            onMouseMove={() => showTip(i)}
          />
        ))}

        {/* hover marker line */}
        {hoverIdx !== null && (
          <line
            x1={geo.x(hoverIdx)} x2={geo.x(hoverIdx)}
            y1={PAD_T} y2={H - PAD_B}
            stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" opacity={0.5}
          />
        )}

        {/* x-axis labels: first / middle / last */}
        {points.length > 1 && (
          <>
            <text x={PAD_L} y={H - 7} fontSize={10} fill={MUTED}>{formatShort(points[0].label)}</text>
            <text
              x={geo.x(Math.floor((points.length - 1) / 2))}
              y={H - 7}
              textAnchor="middle"
              fontSize={10}
              fill={MUTED}
            >
              {formatShort(points[Math.floor((points.length - 1) / 2)].label)}
            </text>
            <text x={W - PAD_R} y={H - 7} textAnchor="end" fontSize={10} fill={MUTED}>
              {formatShort(points[points.length - 1].label)}
            </text>
          </>
        )}
      </svg>

      {tip && (
        <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}>
          <div className="tt-title">{tip.title}</div>
          {tip.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   BarChart — clean comparison bars (weekly averages, habits).
   Null values render as muted placeholder stubs.
   ------------------------------------------------------------ */

export function BarChart({
  points,
  height = 170,
  suffix = '%',
  ariaLabel,
}: {
  points: ChartPoint[];
  height?: number;
  suffix?: string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tooltip | null>(null);

  const W = 720;
  const H = height;
  const PAD_L = 34;
  const PAD_R = 8;
  const PAD_T = 10;
  const PAD_B = 24;

  const hasData = points.some((p) => p.value !== null);

  if (!hasData) {
    return (
      <div className="chart-empty" role="img" aria-label={ariaLabel ?? 'No data yet'}>
        Nothing to compare yet — data appears after your first tracked days.
      </div>
    );
  }

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const slot = innerW / points.length;
  const barW = Math.max(6, Math.min(34, slot * 0.58));
  const y = (v: number) => PAD_T + innerH - (v / 100) * innerH;

  const showTip = (i: number, pct: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const sx = rect.width / W;
    setTip({
      x: rect.left + (PAD_L + slot * i + slot / 2) * sx,
      y: rect.top + y(pct) * (rect.height / H),
      title: points[i].label,
      lines: [pct === null ? 'No data' : `${pct}${suffix}`],
    });
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setTip(null)}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={PAD_L - 7} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill={MUTED}>
              {v}
            </text>
          </g>
        ))}

        {points.map((p, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          const has = p.value !== null;
          const barH = has ? Math.max(3, ((p.value ?? 0) / 100) * innerH) : 3;
          return (
            <g key={i}>
              <rect
                x={cx - slot / 2}
                y={PAD_T}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => showTip(i, p.value ?? 0)}
              />
              {has ? (
                <rect
                  x={cx - barW / 2}
                  y={PAD_T + innerH - barH}
                  width={barW}
                  height={barH}
                  rx={Math.min(5, barW / 2)}
                  fill={ACCENT}
                  opacity={0.88}
                  style={{ transition: 'opacity 0.15s ease' }}
                />
              ) : (
                <rect
                  x={cx - barW / 2}
                  y={PAD_T + innerH - 3}
                  width={barW}
                  height={3}
                  rx={1.5}
                  fill={GRID}
                />
              )}
            </g>
          );
        })}

        {points.length > 1 && (
          <>
            <text x={PAD_L} y={H - 7} fontSize={10} fill={MUTED}>{points[0].label}</text>
            <text x={W - PAD_R} y={H - 7} textAnchor="end" fontSize={10} fill={MUTED}>
              {points[points.length - 1].label}
            </text>
          </>
        )}
      </svg>

      {tip && (
        <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}>
          <div className="tt-title">{tip.title}</div>
          {tip.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
