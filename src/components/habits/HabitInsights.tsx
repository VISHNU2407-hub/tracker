import React, { useMemo, useState } from 'react';
import type { Arc, DailyRecord, Habit } from '../../types';
import type { HabitStat } from '../../services/analytics';
import { addDays, formatShort, todayISO } from '../../services/date';
import { arcLastDay, habitCellFor } from './habitCell';
import { HabitCellLegend } from './HabitCellLegend';
import { IconFlame, IconTrophy, IconCheck } from '../icons';

/* ============================================================
   HabitInsights — richer per-habit performance view built only
   from existing analytics (streaks, completion rate, totals) and
   stored records (recent-activity strip). Answers "How am I doing
   with this specific habit?" without leaving the Habits page.
   ============================================================ */

interface HabitInsightsProps {
  habit: Habit;
  stat: HabitStat;
  arc: Arc;
  records: Record<string, DailyRecord>;
  now?: string;
  defaultOpen?: boolean;
  onDayClick?: (date: string) => void;
}

export function HabitInsights({
  habit, stat, arc, records, now = todayISO(), defaultOpen = true, onDayClick,
}: HabitInsightsProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Rolling window: up to 90 Arc days ending today (or the Arc's last day).
  const { dates, cells, lastCompleted } = useMemo(() => {
    const end = now > arcLastDay(arc) ? arcLastDay(arc) : now;
    const list: string[] = [];
    if (end >= arc.startDate) {
      const start = arc.startDate > addDays(end, -89) ? arc.startDate : addDays(end, -89);
      for (let d = start; d <= end; d = addDays(d, 1)) list.push(d);
    }
    const cellList = list.map((d) => habitCellFor(habit, d, records, now, arc));
    let last: string | null = null;
    for (let i = list.length - 1; i >= 0; i--) {
      if (cellList[i].state === 'done') { last = list[i]; break; }
    }
    return { dates: list, cells: cellList, lastCompleted: last };
  }, [habit, arc, records, now]);

  const todayState = habitCellFor(habit, now, records, now, arc).state;
  const todayLabel =
    todayState === 'done' ? 'Done'
    : todayState === 'pending' ? 'In progress'
    : todayState === 'partial' ? 'In progress'
    : todayState === 'missed' ? 'Missed'
    : todayState === 'na' ? 'Not active'
    : '—';
  const todayClass =
    todayState === 'done' ? 'ok' : todayState === 'na' || todayState === 'outside' ? 'muted' : 'warn';

  const rate = stat.rate;
  const avgPerDay =
    habit.type !== 'checkbox' && stat.eligibleCount > 0
      ? Math.round((stat.totalValue / stat.eligibleCount) * 10) / 10
      : null;

  const targetLabel =
    habit.type === 'checkbox' ? 'Done when checked'
    : habit.type === 'duration' ? `${habit.target} min / day`
    : `${habit.target} ${habit.unit || 'unit'} / day`;

  return (
    <div className="habit-insights">
      <div className="habit-stats">
        <div className="hs-item">
          <span className="hs-k">Current streak</span>
          <span className="hs-v"><IconFlame size={14} style={{ color: 'var(--warning)' }} /> {stat.currentStreak} <span className="hs-unit">days</span></span>
        </div>
        <div className="hs-item">
          <span className="hs-k">Best streak</span>
          <span className="hs-v"><IconTrophy size={14} style={{ color: 'var(--success)' }} /> {stat.bestStreak} <span className="hs-unit">days</span></span>
        </div>
        <div className="hs-item">
          <span className="hs-k">Today</span>
          <span className={`hs-v ${todayClass}`}>{todayState === 'done' && <IconCheck size={14} />} {todayLabel}</span>
        </div>
        <div className="hs-item">
          <span className="hs-k">{habit.type === 'checkbox' ? 'Completed' : 'Total logged'}</span>
          <span className="hs-v">
            {habit.type === 'checkbox' ? `${stat.completedCount} days` : `${stat.totalValue} ${habit.unit || ''}`}
          </span>
          <span className="hs-sub">
            {avgPerDay !== null ? `avg ${avgPerDay} ${habit.unit || ''}/day` : targetLabel}
          </span>
        </div>

        <div className="hs-rate">
          <div className="row-between">
            <span className="hs-k">Completion · {stat.completedCount} of {stat.eligibleCount} eligible days</span>
            <span className="hs-rate-pct">{rate === null ? '—' : `${rate}%`}</span>
          </div>
          <div className="rate-bar" style={{ marginTop: 6 }}>
            <div
              className={`rate-bar-fill${rate !== null && rate >= 80 ? ' good' : ''}`}
              style={{ width: `${rate ?? 0}%` }}
              role="progressbar"
              aria-valuenow={rate ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${habit.name} completion rate`}
            />
          </div>
        </div>
      </div>

      <div className="hi-history">
        <div className="hi-head">
          <div>
            <span className="hs-k">Recent activity</span>
            <span className="hs-range small muted">
              {dates.length > 0
                ? `${formatShort(dates[0])} – ${formatShort(dates[dates.length - 1])} · last ${dates.length} day${dates.length === 1 ? '' : 's'}`
                : 'Your Arc hasn’t started yet'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Hide history' : 'Show history'}
          </button>
        </div>

        {open && dates.length > 0 && (
          <>
            <div className="hi-strip" role="group" aria-label={`${habit.name} — recent days`}>
              {dates.map((d, i) => {
                const c = cells[i];
                const text = `${formatShort(d)}: ${c.label}`;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`mg-cell hi-day ${c.state}`}
                    title={`${text} — open day details`}
                    aria-label={`${text}. Open day details.`}
                    onClick={() => onDayClick?.(d)}
                  >
                    {c.glyph}
                  </button>
                );
              })}
            </div>

            <p className="hi-facts small muted">
              Last completed: <strong>{lastCompleted ? formatShort(lastCompleted) : 'not yet'}</strong>
              {' · '}{stat.eligibleCount} eligible day{stat.eligibleCount === 1 ? '' : 's'} so far
              {lastCompleted === null && stat.completedCount > 0 ? ' (earlier than this window)' : ''}
            </p>

            <HabitCellLegend only={['done', 'partial', 'missed', 'pending', 'na']} />
          </>
        )}
      </div>
    </div>
  );
}
