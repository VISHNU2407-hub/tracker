import React, { useMemo, useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { PageHeader } from '../app/layout/PageHeader';
import { ArcHeatmap } from '../components/calendar/ArcHeatmap';
import { HabitGrid } from '../components/calendar/HabitGrid';
import { DayDetail } from '../components/calendar/DayDetail';
import { addDays, formatDateRange, fromISO, monthGroups, todayISO } from '../services/date';
import { evaluateDay } from '../services/analytics';
import { trackScope } from '../hooks/useArc';
import { IconChevronLeft, IconChevronRight, IconCalendar, IconFlame, IconSpark } from '../components/icons';

/* ============================================================
   Calendar page (spec §3): LeetCode-style heatmaps with
   track and full-year ranges, plus a month grid with
   habits AND rules. Click any track day for details.
   ============================================================ */

type View = 'year' | 'arc' | 'month' | 'grid';

export function CalendarPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const arc = data.arc!;
  const { habits: scopedHabits, rules: scopedRules } = trackScope(data);
  const today = todayISO();
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [view, setView] = useState<View>('year');
  const [monthOffset, setMonthOffset] = useState(0);

  const lastArcDay = addDays(arc.startDate, arc.durationDays - 1);

  // Build month groups from arc start (shared with the habit grid view).
  const months = useMemo(() => monthGroups(arc.startDate, lastArcDay), [arc.startDate, lastArcDay]);

  const month = months[Math.min(monthOffset, months.length - 1)];
  const padDays = month ? (fromISO(month.dates[0]).getDay() + 6) % 7 : 0; // Monday-first padding

  // Track-wide counts for the summary strip.
  const summary = useMemo(() => {
    const dates = Array.from({ length: arc.durationDays }, (_, i) => addDays(arc.startDate, i));
    let perfect = 0;
    let partial = 0;
    let logged = 0;
    for (const d of dates) {
      if (d > today) continue;
      const ev = evaluateDay(arc, scopedHabits, scopedRules, data.dailyRecords, d, today);
      if (ev.pct === null) continue;
      logged += 1;
      if (ev.pct >= 100) perfect += 1;
      else if (ev.pct > 0) partial += 1;
    }
    return { perfect, partial, logged, elapsed: dates.filter((d) => d <= today).length };
  }, [arc, scopedHabits, scopedRules, data.dailyRecords, today]);

  return (
    <div>
      <PageHeader
        title="Calendar"
        sub={`${formatDateRange(arc.startDate, lastArcDay)} · click any track day for details`}
        actions={
          <div className="segmented" style={{ width: 'auto' }} role="group" aria-label="Calendar view">
            <button type="button" className={view === 'year' ? 'active' : ''} onClick={() => setView('year')}>
              Year
            </button>
            <button type="button" className={view === 'arc' ? 'active' : ''} onClick={() => setView('arc')}>
              Track
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
        <div className="card card-summary">
          <div className="card-title">
            <span className="card-title-main">
              <IconCalendar size={14} /> {view === 'year' ? 'Last 365 days' : `${arc.durationDays}-day track`}
            </span>
            <span className="small muted">click any track day for details</span>
          </div>

          <div className="cal-summary">
            <div className="cal-summary-cell">
              <span className="cal-summary-v">{summary.elapsed}</span>
              <span className="cal-summary-k">Days elapsed</span>
            </div>
            <div className="cal-summary-cell">
              <span className="cal-summary-v success-text"><IconSpark size={13} /> {summary.perfect}</span>
              <span className="cal-summary-k">Perfect days</span>
            </div>
            <div className="cal-summary-cell">
              <span className="cal-summary-v"><IconFlame size={13} /> {summary.partial}</span>
              <span className="cal-summary-k">Partial days</span>
            </div>
            <div className="cal-summary-cell">
              <span className="cal-summary-v">{summary.logged}</span>
              <span className="cal-summary-k">Days with trackables</span>
            </div>
          </div>

          <ArcHeatmap
            arc={arc}
            habits={scopedHabits}
            rules={scopedRules}
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
                <IconChevronLeft size={16} />
              </button>
              <button type="button" className="btn btn-icon" onClick={() => setMonthOffset((m) => Math.min(months.length - 1, m + 1))} disabled={monthOffset >= months.length - 1} aria-label="Next month">
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>

          {view === 'grid' && month && (
            <HabitGrid
              arc={arc}
              habits={scopedHabits}
              rules={scopedRules}
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
                  const ev = evaluateDay(arc, scopedHabits, scopedRules, data.dailyRecords, date, today);
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
