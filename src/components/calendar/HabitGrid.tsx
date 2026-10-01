import React, { useMemo } from 'react';
import type { Arc, DailyRecord, Habit } from '../../types';
import { eligibleHabitsForDate, evaluateDay, habitValueDone } from '../../services/analytics';
import { formatLong, formatShort, fromISO, todayISO, weekdayInitial } from '../../services/date';
import { habitCellFor } from '../habits/habitCell';
import { HabitCellLegend } from '../habits/HabitCellLegend';
import { IconLock } from '../icons';
import { IconFor } from '../../pages/Habits';

/* ============================================================
   HabitGrid — monthly habit tracker (rows = habits, columns =
   days of the month). Inspired by monthly habit-grid layouts,
   but built entirely on the existing habit/day data model:
   eligibility + completion rules come from the analytics service,
   future days stay locked, and every cell is derived — nothing
   new is stored.
   ============================================================ */

interface HabitGridProps {
  arc: Arc;
  habits: Habit[];
  records: Record<string, DailyRecord>;
  /** Days of the visible month (already clamped to the Arc window). */
  dates: string[];
  now?: string;
  onDayClick?: (date: string) => void;
}

export function HabitGrid({ arc, habits, records, dates, now = todayISO(), onDayClick }: HabitGridProps) {
  const label = useMemo(
    () =>
      dates[0]
        ? fromISO(dates[0]).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : '',
    [dates]
  );

  const rows = useMemo(() => {
    const sorted = [...habits].sort((a, b) => a.order - b.order);
    return [...sorted.filter((h) => h.active), ...sorted.filter((h) => !h.active)];
  }, [habits]);

  // Month-level summary line (elapsed days only, real evaluateDay output).
  const monthSummary = useMemo(() => {
    let elapsed = 0;
    let pctSum = 0;
    let perfect = 0;
    for (const d of dates) {
      if (d > now) continue;
      const ev = evaluateDay(arc, habits, records, d, now);
      if (ev.pct === null) continue;
      elapsed += 1;
      pctSum += ev.pct;
      if (ev.isPerfect) perfect += 1;
    }
    return { elapsed, perfect, avg: elapsed === 0 ? null : Math.round(pctSum / elapsed) };
  }, [arc, habits, records, dates, now]);

  /** Per-habit summary for the visible month: done / eligible days. */
  const summaryFor = (habit: Habit) => {
    let eligible = 0;
    let done = 0;
    for (const d of dates) {
      if (d > now) continue;
      if (eligibleHabitsForDate([habit], d, now).length === 0) continue;
      eligible += 1;
      if (habitValueDone(habit, records[d]?.habits[habit.id])) done += 1;
    }
    return { eligible, done, pct: eligible === 0 ? null : Math.round((done / eligible) * 100) };
  };

  if (dates.length === 0 || rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="big">{dates.length === 0 ? 'No days in this month' : 'No habits yet'}</div>
        <p>Add habits on the Habits page — the grid fills in as you track days.</p>
      </div>
    );
  }

  return (
    <div className="mg-wrap">
      <div className="mg-summary small secondary">
        {monthSummary.avg === null
          ? 'No elapsed Arc days in this month yet.'
          : `${monthSummary.elapsed} elapsed day${monthSummary.elapsed === 1 ? '' : 's'} this month · ${monthSummary.avg}% average · ${monthSummary.perfect} perfect`}
      </div>

      <div className="mg-scroll">
        <table className="mg-table">
          <caption className="sr-only">
            {`Monthly habit tracker for ${label}. Rows are habits, columns are days of the month.`}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="mg-name-col">Habit</th>
              {dates.map((d) => {
                const isToday = d === now;
                const weekend = [0, 6].includes(fromISO(d).getDay());
                const hasNote = Boolean(records[d]?.note);
                const dayNum = Number(d.slice(8, 10));
                return (
                  <th
                    key={d}
                    scope="col"
                    className={`mg-head${isToday ? ' today' : ''}${weekend ? ' weekend' : ''}`}
                  >
                    <button
                      type="button"
                      className="mg-day-btn"
                      onClick={() => onDayClick?.(d)}
                      title={`${formatLong(d)}${hasNote ? ' · has a note' : ''} — open day details`}
                      aria-label={`${formatLong(d)}${hasNote ? ', has a note' : ''}. Open day details.`}
                    >
                      <span className="mg-wd" aria-hidden="true">{weekdayInitial(d)}</span>
                      <span className="mg-num">{dayNum}</span>
                      {hasNote && (
                        <span className="mg-note-dot" aria-hidden="true" />
                      )}
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="mg-sum-col">Month</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((habit) => {
              const Icon = IconFor(habit.icon);
              const sum = summaryFor(habit);
              return (
                <tr key={habit.id} className={habit.active ? undefined : 'paused'}>
                  <th scope="row" className="mg-name-col">
                    <span className="mg-name-inner">
                      <span className="mg-icon"><Icon size={13} /></span>
                      <span className="mg-habit-name truncate" title={habit.name}>{habit.name}</span>
                      {!habit.active && <span className="hc-chip paused">Paused</span>}
                    </span>
                  </th>

                  {dates.map((d) => {
                    const c = habitCellFor(habit, d, records, now, arc);
                    const text = `${formatShort(d)}: ${c.label}`;
                    return (
                      <td key={d} className={`mg-cell ${c.state}`} title={text}>
                        {c.state === 'future' ? <IconLock size={11} /> : c.glyph}
                        <span className="sr-only">{text}</span>
                      </td>
                    );
                  })}

                  <td
                    className="mg-sum-col"
                    title={
                      sum.eligible === 0
                        ? 'No eligible days this month'
                        : `${sum.done} of ${sum.eligible} eligible days completed this month`
                    }
                  >
                    <span className="mg-sum-pct">{sum.pct === null ? '—' : `${sum.pct}%`}</span>
                    <span className="mg-sum-sub">{sum.eligible === 0 ? 'no days' : `${sum.done}/${sum.eligible}`}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <HabitCellLegend />
    </div>
  );
}
