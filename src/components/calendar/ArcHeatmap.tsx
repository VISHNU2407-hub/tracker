import React, { useMemo, useRef, useState } from 'react';
import type { Arc, DailyRecord, Habit, Rule } from '../../types';
import { evaluateDay } from '../../services/analytics';
import { addDays, formatShort, fromISO, todayISO, isWeekend } from '../../services/date';

/* ============================================================
   ArcHeatmap — LeetCode/GitHub-style contribution graph:
   columns = weeks, rows = weekdays (Mon..Sun), color intensity
   = daily completion % (habits + rules combined).

   range="arc"  → the 90-day Arc window only.
   range="year" → rolling 365 days ending today (full-year
                  canvas, Arc days highlighted inside it).
   ============================================================ */

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function heatLevel(pct: number | null): HeatLevel {
  if (pct === null || pct === 0) return 0;
  if (pct < 34) return 1;
  if (pct < 67) return 2;
  if (pct < 100) return 3;
  return 4;
}

interface ArcHeatmapProps {
  arc: Arc;
  habits: Habit[];
  rules: Rule[];
  records: Record<string, DailyRecord>;
  onDayClick?: (date: string) => void;
  showMonthLabels?: boolean;
  showLegend?: boolean;
  cellSize?: number;
  range?: 'arc' | 'year';
}

const LEVEL_TEXT: Record<HeatLevel, string> = {
  0: 'No progress',
  1: 'Low (1–33%)',
  2: 'Medium (34–66%)',
  3: 'High (67–99%)',
  4: 'Perfect (100%)',
};

interface HeatColumn {
  key: string;
  days: (string | null)[];
  monthLabel: string | null;
  monthStart: boolean;
}

export function ArcHeatmap({
  arc, habits, rules, records, onDayClick, showMonthLabels = true, showLegend = true, cellSize = 13,
  range = 'arc',
}: ArcHeatmapProps) {
  const now = todayISO();
  const lastArcDay = useMemo(() => addDays(arc.startDate, arc.durationDays - 1), [arc.startDate, arc.durationDays]);
  const gridRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => {
    // Determine the window the grid covers.
    let windowStart: string;
    let windowEnd: string;
    if (range === 'year') {
      windowEnd = now;
      windowStart = addDays(now, -364); // rolling 365 days
    } else {
      windowStart = arc.startDate;
      windowEnd = lastArcDay;
    }
    // Snap the start to the Monday on/before so rows are Mon..Sun.
    const backToMonday = -((fromISO(windowStart).getDay() + 6) % 7);
    const gridStart = addDays(windowStart, backToMonday);

    const cols: HeatColumn[] = [];
    let cursor = gridStart;
    let i = 0;
    while (cursor <= windowEnd) {
      const days: (string | null)[] = [];
      for (let r = 0; r < 7; r++) {
        days.push(cursor <= windowEnd ? cursor : null);
        cursor = addDays(cursor, 1);
      }
      cols.push({ key: days.find(Boolean) ?? `pad-${i}`, days, monthLabel: null, monthStart: false });
      i++;
    }

    // Month labels + month-start gaps: mark the first column of each new month.
    let prevMonth = -1;
    for (const col of cols) {
      const firstDay = col.days.find((d): d is string => d !== null);
      if (!firstDay) continue;
      const d = fromISO(firstDay);
      if (d.getMonth() !== prevMonth) {
        col.monthLabel = d.toLocaleDateString(undefined, { month: 'short' });
        col.monthStart = true;
        prevMonth = d.getMonth();
      }
    }
    return cols;
  }, [arc.startDate, lastArcDay, range, now]);

  // Dates inside the Arc reachable via keyboard: Day 1..duration up to today.
  // Outside-arc and future cells remain mouse/touch clickable but are not
  // tab stops, so Tabbing through the heatmap costs a single stop.
  const keyNavigable = useMemo(() => {
    const list: string[] = [];
    for (const col of columns) {
      for (const d of col.days) {
        if (!d) continue;
        const n = Math.round((fromISO(d).getTime() - fromISO(arc.startDate).getTime()) / 86_400_000) + 1;
        if (n >= 1 && n <= arc.durationDays && d <= now) list.push(d);
      }
    }
    return list;
  }, [columns, arc.startDate, arc.durationDays, now]);

  // Roving tabindex: exactly one cell (default: today, else the first
  // reachable day) is in the tab order; arrows move focus and scroll it
  // into view within `keyNavigable`.
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const defaultCell = keyNavigable.includes(now) ? now : keyNavigable[0];
  const focusedCell =
    activeCell !== null && keyNavigable.includes(activeCell) ? activeCell : defaultCell;

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(e.key) || keyNavigable.length === 0) return;
    e.preventDefault();
    const idx = keyNavigable.indexOf(focusedCell);
    let next: number;
    switch (e.key) {
      case 'ArrowLeft': next = idx - 1; break;  // previous day
      case 'ArrowRight': next = idx + 1; break; // next day
      case 'ArrowUp': next = idx - 7; break;    // same weekday, previous week
      case 'ArrowDown': next = idx + 7; break;  // same weekday, next week
      case 'Home': next = 0; break;
      default: next = keyNavigable.length - 1;  // End
    }
    next = Math.max(0, Math.min(keyNavigable.length - 1, next));
    const target = keyNavigable[next];
    setActiveCell(target);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus();
  };

  // Summary line, like LeetCode's "X submissions" ribbon.
  const summary = useMemo(() => {
    const elapsed = Math.min(
      Math.max(
        Math.round((fromISO(now).getTime() - fromISO(arc.startDate).getTime()) / 86_400_000) + 1,
        0
      ),
      arc.durationDays
    );
    let tracked = 0;
    let perfect = 0;
    for (let i = 0; i < elapsed; i++) {
      const ev = evaluateDay(arc, habits, rules, records, addDays(arc.startDate, i), now);
      if (ev.pct !== null && ev.completedCount > 0) tracked++;
      if (ev.isPerfect) perfect++;
    }
    const yearNote = range === 'year' ? ' · last 365 days shown' : '';
    if (elapsed === 0) return `Your Arc hasn't started yet.${yearNote}`;
    if (tracked === 0) return `Day 1–${elapsed}: no progress logged yet — the grid fills in as you complete habits.${yearNote}`;
    return `${perfect} perfect · ${tracked} active · ${elapsed - tracked} missed of the first ${elapsed} day${elapsed === 1 ? '' : 's'}${yearNote}`;
  }, [arc, habits, rules, records, now, range]);

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-summary small secondary">{summary}</div>

      <div className="heatmap-scroll">
        <div className="heatmap" style={{ ['--cell' as string]: `${cellSize}px` }}>
          {showMonthLabels && (
            <div className="heatmap-months" aria-hidden="true">
              {columns.map((col) => (
                <div key={col.key} className={`heatmap-month${col.monthStart ? ' month-start' : ''}`}>
                  {col.monthLabel ?? ''}
                </div>
              ))}
            </div>
          )}

          <div className="heatmap-body">
            <div className="heatmap-weekdays" aria-hidden="true">
              {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
                <div key={i} className="heatmap-weekday">{d}</div>
              ))}
            </div>

            <div
              ref={gridRef}
              className="heatmap-grid"
              role="grid"
              aria-label={range === 'year' ? 'Last 365 days completion heatmap' : '90-day completion heatmap'}
              tabIndex={0}
              onKeyDown={onGridKeyDown}
            >
              {columns.map((col) => (
                <div className={`heatmap-col${col.monthStart ? ' month-start' : ''}`} key={col.key} role="row">
                  {col.days.map((date, ri) => {
                    if (!date) {
                      return <div key={`${col.key}-${ri}`} className="heat-cell ghost" aria-hidden="true" />;
                    }
                    const dayNum =
                      Math.round((fromISO(date).getTime() - fromISO(arc.startDate).getTime()) / 86_400_000) + 1;
                    const inArc = dayNum >= 1 && dayNum <= arc.durationDays;

                    if (!inArc) {
                      const label = `${formatShort(date)} · outside your Arc`;
                      return (
                        <div
                          key={date}
                          className="heat-cell lvl-0 outside"
                          title={label}
                          aria-hidden="true"
                        />
                      );
                    }

                    const ev = evaluateDay(arc, habits, rules, records, date, now);
                    const lvl = heatLevel(ev.pct);
                    const isToday = date === now;
                    const weekend = isWeekend(date);
                    const label = `Day ${dayNum} · ${formatShort(date)} · ${LEVEL_TEXT[lvl]}`;
                    const isFuture = ev.state === 'future';
                    const inTabOrder = date === focusedCell;

                    return (
                      <button
                        key={date}
                        type="button"
                        role="gridcell"
                        data-date={date}
                        tabIndex={inTabOrder ? 0 : -1}
                        className={['heat-cell', `lvl-${lvl}`, weekend ? 'weekend' : '', isToday ? 'today' : '', isFuture ? 'future' : '']
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => onDayClick?.(date)}
                        onFocus={() => setActiveCell(date)}
                        aria-label={`${label}${isFuture ? ' (upcoming — view only)' : ''}`}
                        title={label}
                      >
                        {isToday && <span className="sr-only">Today</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="heatmap-legend">
          <span className="muted small">Less</span>
          {([0, 1, 2, 3, 4] as HeatLevel[]).map((l) => (
            <span key={l} className={`heat-cell lvl-${l} legend-cell`} aria-hidden="true" />
          ))}
          <span className="muted small">More</span>
          <span className="legend-today">
            <span className="heat-cell today legend-cell" aria-hidden="true" />
            <span className="muted small">today</span>
          </span>
        </div>
      )}
    </div>
  );
}
