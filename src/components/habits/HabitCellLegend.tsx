import React from 'react';
import type { HabitCellState } from './habitCell';

/* ============================================================
   HabitCellLegend — shared legend for the monthly habit grid
   and per-habit history strips. Uses glyph + text, never color
   alone (spec §10 accessibility).
   ============================================================ */

interface LegendEntry {
  state: HabitCellState | 'note';
  glyph: string;
  label: string;
}

const ENTRIES: LegendEntry[] = [
  { state: 'done', glyph: '✓', label: 'Done' },
  { state: 'partial', glyph: '◐', label: 'Partial' },
  { state: 'missed', glyph: '✕', label: 'Missed' },
  { state: 'pending', glyph: '○', label: 'Today — in progress' },
  { state: 'na', glyph: '·', label: 'Not applicable / paused' },
  { state: 'future', glyph: '', label: 'Locked (future)' },
  { state: 'note', glyph: '•', label: 'Day has a note' },
];

/** `only` restricts the legend to states that can actually occur
 *  (e.g. history strips end today, so they never show future days). */
export function HabitCellLegend({ only }: { only?: HabitCellState[] }) {
  const entries = only
    ? ENTRIES.filter((e) => e.state !== 'note' && only.includes(e.state as HabitCellState))
    : ENTRIES;
  return (
    <div className="grid-legend" role="group" aria-label="Legend">
      {entries.map((e) => (
        <span className="legend-item" key={e.state}>
          <span
            className={`mg-legend-cell${e.state === 'note' ? ' note' : ` ${e.state}`}`}
            aria-hidden="true"
          >
            {e.glyph}
          </span>
          {e.label}
        </span>
      ))}
    </div>
  );
}
