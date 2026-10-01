import React from 'react';
import type { Arc, DailyRecord, Habit, Rule } from '../../types';
import { evaluateDay } from '../../services/analytics';
import { addDays, formatShort, isWeekend, todayISO } from '../../services/date';

interface NinetyDayGridProps {
  arc: Arc;
  habits: Habit[];
  rules?: Rule[];
  records: Record<string, DailyRecord>;
  onDayClick?: (date: string) => void;
  compact?: boolean;
}

const STATE_LABEL: Record<string, string> = {
  complete: 'Completed',
  partial: 'Partial',
  empty: 'Missed / no progress',
  today: 'In progress today',
  future: 'Upcoming',
};

/** Full 90-day map with state + text title (never color-only, spec §10). */
export function NinetyDayGrid({ arc, habits, rules = [], records, onDayClick, compact }: NinetyDayGridProps) {
  const now = todayISO();
  const cells: React.ReactNode[] = [];

  for (let i = 0; i < arc.durationDays; i++) {
    const date = addDays(arc.startDate, i);
    const ev = evaluateDay(arc, habits, rules, records, date, now);
    const cls = [
      'day-cell',
      ev.state,
      ev.state === 'today' && ev.isPerfect ? 'complete' : '',
      isWeekend(date) ? 'weekend' : '',
    ]
      .filter(Boolean)
      .join(' ');

    cells.push(
      <button
        key={date}
        type="button"
        className={cls}
        onClick={() => onDayClick?.(date)}
        title={`Day ${i + 1} · ${formatShort(date)} · ${STATE_LABEL[ev.state] ?? ev.state}${
          ev.pct !== null ? ` · ${ev.pct}%` : ''
        }`}
        aria-label={`Day ${i + 1}, ${formatShort(date)}: ${STATE_LABEL[ev.state] ?? ev.state}`}
      >
        <span className="day-cell-num">{i + 1}</span>
      </button>
    );
  }

  return (
    <div>
      <div className={`day-grid${compact ? ' compact' : ''}`} role="list" aria-label="90 day overview">
        {cells}
      </div>
      <div className="grid-legend" aria-hidden="false">
        <Legend swatch="complete" label="Complete" />
        <Legend swatch="partial" label="Partial" />
        <Legend swatch="empty" label="Missed" />
        <Legend swatch="today" label="Today" />
        <Legend swatch="future" label="Upcoming" />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="legend-item">
      <span className={`legend-swatch ${swatch}`} aria-hidden="true" />
      {label}
    </span>
  );
}
