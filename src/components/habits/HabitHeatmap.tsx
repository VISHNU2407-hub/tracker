import React, { useEffect, useMemo, useState } from 'react';
import type { Arc, DailyRecord, Habit } from '../../types';
import { addDays, formatLong, formatShort, fromISO, todayISO } from '../../services/date';
import { arcLastDay, habitCellFor, type HabitCellState, type HabitCellView } from './habitCell';

/* ============================================================
   HabitHeatmap — compact per-habit 90-day contribution grid.
   Each habit card gets its OWN heatmap, built only from that
   habit's stored records (never overall daily completion).
   The 90 chronologically ordered day-squares are grouped by
   month as weekday-aligned mini calendars, colored in subtle
   shades of the primary blue, with a hover/click popover that
   shows the day's details. Purely derived from the existing
   analytics eligibility + completion rules — nothing new is
   stored.
   ============================================================ */

const WINDOW_DAYS = 90;

const STATUS_TEXT: Record<HabitCellState, string> = {
  done: 'Completed',
  partial: 'Partial progress',
  missed: 'Missed',
  pending: 'In progress today',
  na: 'Not applicable / paused',
  future: 'Locked — future day',
  outside: 'Outside your track',
};

interface MonthBucket {
  key: string;
  label: string;
  /** Ghost cells before day 1 so the mini calendar aligns to real weekdays. */
  pad: number;
  dates: string[];
}

interface Anchor {
  date: string;
  rect: DOMRect;
}

interface HabitHeatmapProps {
  habit: Habit;
  arc: Arc;
  records: Record<string, DailyRecord>;
  now?: string;
}

/** Keep the popover on screen: centered above the cell, or below when near the top. */
function popoverStyle(rect: DOMRect): React.CSSProperties {
  const W = 248;
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - W / 2, window.innerWidth - W - 8));
  if (rect.top > 210) return { left, width: W, bottom: window.innerHeight - rect.top + 8 };
  return { left, width: W, top: rect.bottom + 8 };
}

export function HabitHeatmap({ habit, arc, records, now = todayISO() }: HabitHeatmapProps) {
  // Rolling window: up to 90 Arc days ending today (or the Arc's last day).
  const { months, cells, total, doneCount, rangeLabel } = useMemo(() => {
    const end = now > arcLastDay(arc) ? arcLastDay(arc) : now;
    const list: string[] = [];
    if (end >= arc.startDate) {
      const start = arc.startDate > addDays(end, -(WINDOW_DAYS - 1)) ? arc.startDate : addDays(end, -(WINDOW_DAYS - 1));
      for (let d = start; d <= end; d = addDays(d, 1)) list.push(d);
    }
    const views = list.map((d) => habitCellFor(habit, d, records, now, arc));
    const map = new Map<string, HabitCellView>();
    list.forEach((d, i) => map.set(d, views[i]));

    const sameYear = new Set(list.map((d) => d.slice(0, 4))).size <= 1;
    const buckets: MonthBucket[] = [];
    for (const d of list) {
      const key = d.slice(0, 7);
      const last = buckets[buckets.length - 1];
      if (last && last.key === key) {
        last.dates.push(d);
      } else {
        buckets.push({
          key,
          label: fromISO(d).toLocaleDateString(undefined, {
            month: 'short',
            ...(sameYear ? {} : { year: '2-digit' }),
          }),
          pad: (fromISO(d).getDay() + 6) % 7, // Monday-first weekday alignment
          dates: [d],
        });
      }
    }

    return {
      months: buckets,
      cells: map,
      total: list.length,
      doneCount: views.filter((v) => v.state === 'done').length,
      rangeLabel: list.length ? `${formatShort(list[0])} – ${formatShort(list[list.length - 1])}` : '',
    };
  }, [habit, arc, records, now]);

  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  // Pinned popover (tap/click): closes on outside click or Escape.
  useEffect(() => {
    if (!pinned) return;
    const close = () => {
      setPinned(null);
      setAnchor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  if (total === 0) {
    return (
      <div className="hhm hhm-empty small muted">
        Your track hasn’t started yet — this habit’s heatmap appears on day 1.
      </div>
    );
  }

  const view = anchor ? cells.get(anchor.date) ?? null : null;
  const rec = anchor ? records[anchor.date]?.habits[habit.id] : undefined;
  const isQuant = habit.type !== 'checkbox';
  const unit = habit.type === 'duration' ? 'min' : habit.unit || 'units';
  const value = rec?.value ?? 0;
  const pctOfTarget = habit.target > 0 ? Math.min(100, Math.round((value / habit.target) * 100)) : 0;
  const showValues = view !== null && ['done', 'partial', 'missed', 'pending'].includes(view.state);
  const completionText =
    view === null ? ''
    : view.state === 'done' ? 'Target met'
    : view.state === 'partial' ? `${pctOfTarget}% of target`
    : view.state === 'pending' ? 'In progress — not done yet'
    : view.state === 'na' ? 'Not applicable'
    : view.state === 'future' ? 'Upcoming'
    : 'Not completed';

  return (
    <div className="hhm" onMouseLeave={() => { if (!pinned) setAnchor(null); }}>
      <div className="hhm-months" role="group" aria-label={`${habit.name} — last ${total} days`}>
        {months.map((m) => (
          <div className="hhm-month" key={m.key}>
            <span className="hhm-month-label">{m.label}</span>
            <div className="hhm-grid">
              {Array.from({ length: m.pad }, (_, i) => (
                <span key={`pad-${i}`} className="hhm-cell ghost" aria-hidden="true" />
              ))}
              {m.dates.map((d) => {
                const c = cells.get(d)!;
                const cls = `hhm-cell ${c.state}${d === now ? ' today' : ''}`;
                return (
                  <button
                    key={d}
                    type="button"
                    className={cls}
                    aria-label={`${formatLong(d)}: ${c.label}`}
                    onMouseEnter={(e) => {
                      if (pinned) return;
                      setAnchor({ date: d, rect: e.currentTarget.getBoundingClientRect() });
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pinned === d) {
                        setPinned(null);
                        setAnchor(null);
                      } else {
                        setPinned(d);
                        setAnchor({ date: d, rect: e.currentTarget.getBoundingClientRect() });
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hhm-foot">
        <span>
          <strong>{doneCount}</strong> / {total} completed
          {rangeLabel && <span className="muted"> · {rangeLabel}</span>}
        </span>
        <span className="hhm-legend" aria-hidden="true">
          <span className="hhm-legend-item"><span className="hhm-cell done" />Completed</span>
          <span className="hhm-legend-item"><span className="hhm-cell partial" />Partial</span>
          <span className="hhm-legend-item"><span className="hhm-cell missed" />Missed</span>
          <span className="hhm-legend-item"><span className="hhm-cell pending today" />Today</span>
          <span className="hhm-legend-item"><span className="hhm-cell na" />N/A</span>
        </span>
      </div>

      {anchor && view && (
        <div className="hhm-pop" style={popoverStyle(anchor.rect)} role="status">
          <div className="hhm-pop-date">{formatLong(anchor.date)}</div>
          <div className="hhm-pop-habit">{habit.name}</div>
          <div className="hhm-pop-row">
            <span className="k">Status</span>
            <span className="v">{STATUS_TEXT[view.state]}</span>
          </div>
          {isQuant && showValues && (
            <div className="hhm-pop-row">
              <span className="k">Actual</span>
              <span className="v">{value} {unit}</span>
            </div>
          )}
          <div className="hhm-pop-row">
            <span className="k">Target</span>
            <span className="v">{isQuant ? `${habit.target} ${unit}` : 'Daily check-in'}</span>
          </div>
          <div className={`hhm-pop-state${view.state === 'done' ? ' done' : view.state === 'partial' ? ' partial' : ''}`}>
            <span className={`hhm-cell ${view.state}`} aria-hidden="true" />
            {completionText}
          </div>
        </div>
      )}
    </div>
  );
}
