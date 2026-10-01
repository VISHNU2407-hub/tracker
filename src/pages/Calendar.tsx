import React, { useMemo, useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { PageHeader } from '../app/layout/PageHeader';
import { ArcHeatmap } from '../components/calendar/ArcHeatmap';
import { HabitGrid } from '../components/calendar/HabitGrid';
import { DayDetail } from '../components/calendar/DayDetail';
import { addDays, formatDateRange, fromISO, monthGroups, todayISO } from '../services/date';
import { evaluateDay } from '../services/analytics';

/* ============================================================
   Calendar page (spec §3): LeetCode-style heatmaps with
   Arc (90-day) and full-year ranges, plus a month grid with
   habits AND rules. Click any arc day for details.
   ============================================================ */

type View = 'year' | 'arc' | 'month' | 'grid';

export function CalendarPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const arc = data.arc!;
  const today = todayISO();
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [view, setView] = useState<View>('year');
  const [monthOffset, setMonthOffset] = useState(0);

  const lastArcDay = addDays(arc.startDate, arc.durationDays - 1);

  // Build month groups from arc start (shared with the habit grid view).
  const months = useMemo(() => monthGroups(arc.startDate, lastArcDay), [arc.startDate, lastArcDay]);

  const month = months[Math.min(monthOffset, months.length - 1)];
  const padDays = month ? (fromISO(month.dates[0]).getDay() + 6) % 7 : 0; // Monday-first padding

  return (
    <div>
      <PageHeader
        title="Calendar"
        sub={`${formatDateRange(arc.startDate, lastArcDay)} · click any arc day for details`}
        actions={
          <div className="segmented" style={{ width: 'auto' }} role="group" aria-label="Calendar view">
            <button type="button" className={view === 'year' ? 'active' : ''} onClick={() => setView('year')}>
              Year
            </button>
            <button type="button" className={view === 'arc' ? 'active' : ''} onClick={() => setView('arc')}>
              Arc
            </button>
            <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>
              Month
            </button>
            <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
              Tracker
            </button>
          </div>
        }
      />

      {(view === 'year' || view === 'arc') && (
        <div className="card">
          <div className="card-title">
            <span>{view === 'year' ? 'Last 365 days' : `${arc.durationDays}-day Arc`}</span>
          </div>
          <ArcHeatmap
            arc={arc}
            habits={data.habits}
            rules={data.rules}
            records={data.dailyRecords}
            onDayClick={setDetailDate}
            cellSize={view === 'year' ? 12 : 14}
            range={view === 'year' ? 'year' : 'arc'}
          />
        </div>
      )}

      {(view === 'month' || view === 'grid') && (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              {view === 'grid' ? `Habit & rule tracker · ${month?.label ?? ''}` : month?.label}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn-icon" onClick={() => setMonthOffset((m) => Math.max(0, m - 1))} disabled={monthOffset === 0} aria-label="Previous month">
                ‹
              </button>
              <button type="button" className="btn btn-icon" onClick={() => setMonthOffset((m) => Math.min(months.length - 1, m + 1))} disabled={monthOffset >= months.length - 1} aria-label="Next month">
                ›
              </button>
            </div>
          </div>

          {view === 'grid' && month && (
            <HabitGrid
              arc={arc}
              habits={data.habits}
              rules={data.rules}
              records={data.dailyRecords}
              dates={month.dates}
              now={today}
              onDayClick={setDetailDate}
            />
          )}

          {view === 'month' && month && (
            <>
              <div className="day-grid">
                {Array.from({ length: padDays }).map((_, i) => (
                  <span key={`pad-${i}`} className="day-cell pad" aria-hidden="true" />
                ))}
                {month.dates.map((date) => {
                  const ev = evaluateDay(arc, data.habits, data.rules, data.dailyRecords, date, today);
                  const cls = ['day-cell', ev.state, ev.state === 'today' && ev.isPerfect ? 'complete' : '']
                    .filter(Boolean).join(' ');
                  return (
                    <button
                      key={date}
                      type="button"
                      className={cls}
                      onClick={() => setDetailDate(date)}
                      title={`${date} · ${ev.pct !== null ? `${ev.pct}%` : 'upcoming'}`}
                      aria-label={`Day ${date}: ${ev.pct !== null ? `${ev.pct}% complete` : 'upcoming'}. Open details.`}
                    >
                      <span className="day-cell-num">{Number(date.slice(8, 10))}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid-legend">
                <span className="legend-item"><span className="legend-swatch complete" /> Completed</span>
                <span className="legend-item"><span className="legend-swatch partial" /> Partial</span>
                <span className="legend-item"><span className="legend-swatch empty" /> Missed</span>
                <span className="legend-item"><span className="legend-swatch today" /> Today</span>
                <span className="legend-item"><span className="legend-swatch" /> Upcoming</span>
              </div>
            </>
          )}
        </div>
      )}

      {detailDate && <DayDetail date={detailDate} api={api} onClose={() => setDetailDate(null)} />}
    </div>
  );
}
