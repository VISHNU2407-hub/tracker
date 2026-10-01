import React, { useMemo, useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { useAnalytics } from '../hooks/useArc';
import type { PageId } from '../hooks/useArc';
import { PageHeader } from '../app/layout/PageHeader';
import { DayTasks } from '../components/dashboard/DayTasks';
import { ProgressRing } from '../components/ui/ProgressRing';
import { ConfirmModal } from '../components/ui/Modal';
import { IconChevronLeft, IconChevronRight, IconLock, IconNote, IconAlert } from '../components/icons';
import { addDays, dayNumber, formatLong, todayISO } from '../services/date';

/* ============================================================
   Today page (spec §3): focused daily view with date navigation.
   Future days are viewable but protected from completion.
   ============================================================ */

export function TodayPage({ api, onNavigate }: { api: AppDataApi; onNavigate: (p: PageId) => void }) {
  const { data } = api;
  const arc = data.arc!;
  const today = todayISO();
  const { evaluate } = useAnalytics(data);

  const [viewDate, setViewDate] = useState<string>(today);
  const [note, setNote] = useState<string | null>(null);
  const [confirmJump, setConfirmJump] = useState<string | null>(null);

  // Clamp to the Arc window. Future days stay viewable (read-only below);
  // only days before the Arc starts get pulled up to Day 1.
  const clamped = useMemo(() => {
    if (viewDate < arc.startDate) return arc.startDate;
    const last = addDays(arc.startDate, arc.durationDays - 1);
    if (viewDate > last) return last;
    return viewDate;
  }, [viewDate, arc]);

  const ev = evaluate(clamped)!;
  const rec = data.dailyRecords[clamped];
  const isPast = clamped < today;
  const isToday = clamped === today;
  const isFuture = clamped > today;

  const noteValue = note ?? rec?.note ?? '';
  const noteDirty = note !== null && note !== (rec?.note ?? '');

  const saveNote = () => {
    api.setDayNote(clamped, noteValue);
    setNote(null);
  };

  const goto = (d: string) => {
    setNote(null);
    setViewDate(d);
  };

  const jumpToDay = (raw: string) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > arc.durationDays) return;
    const target = addDays(arc.startDate, n - 1);
    if (target === clamped) return; // already viewing it
    if (target > today) {
      setConfirmJump(target); // future days need explicit confirmation (spec §10)
    } else {
      goto(target);
    }
  };

  const lastArcDay = addDays(arc.startDate, arc.durationDays - 1);

  return (
    <div>
      <PageHeader
        title={isToday ? 'Today' : `Day view`}
        sub={formatLong(clamped)}
        actions={
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-icon" onClick={() => goto(addDays(clamped, -1))} disabled={clamped <= arc.startDate} aria-label="Previous day">
              <IconChevronLeft size={16} />
            </button>
            <button type="button" className="btn btn-icon" onClick={() => goto(addDays(clamped, 1))} disabled={clamped >= lastArcDay} aria-label="Next day">
              <IconChevronRight size={16} />
            </button>
            {!isToday && (
              <button type="button" className="btn btn-sm" onClick={() => goto(today)}>Back to today</button>
            )}
          </div>
        }
      />

      {isPast && (
        <div
          className="coming-note"
          role="status"
          style={{ marginBottom: 16, background: 'var(--warning-dim)', borderColor: 'var(--warning-border)' }}
        >
          <IconAlert size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
          <span>
            You are editing a <strong>past day</strong>. Changes here update streaks and analytics.
          </span>
        </div>
      )}

      {isFuture && (
        <div
          className="coming-note"
          role="status"
          style={{ marginBottom: 16, background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}
        >
          <IconLock size={15} style={{ color: 'var(--accent-strong)', flexShrink: 0, marginTop: 2 }} />
          <span>
            Viewing a <strong>future day</strong>. It becomes editable once this date arrives.
          </span>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>          <div className="card">
            <div className="card-title">
              <span>Day {dayNumber(clamped, arc.startDate, arc.durationDays)} · Tracking</span>
              {isFuture && (
                <span className="row muted small" style={{ gap: 5 }}>
                  <IconLock size={13} /> Future — locked
                </span>
              )}
            </div>

          {isFuture ? (
            <div className="empty-state">
              <IconLock size={28} style={{ color: 'var(--text-muted)' }} />
              <div className="big" style={{ marginTop: 8 }}>This day hasn't arrived yet</div>
              <p>Future days are protected from accidental completion.</p>
            </div>
          ) : (
            <DayTasks
              arc={arc}
              habits={data.habits}
              rules={data.rules}
              records={data.dailyRecords}
              date={clamped}
              now={today}
              onToggle={api.toggleHabit}
              onSetValue={api.setHabitValue}
              onRuleStatus={api.setRuleStatus}
            />
          )}
        </div>

        <div className="stack">
          <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
            <ProgressRing pct={ev.pct} size={130} stroke={10} label={`Day ${dayNumber(clamped, arc.startDate, arc.durationDays)}`} />
            <p className="small muted" style={{ marginTop: 10 }}>
              {ev.pct === null
                ? 'No eligible habits or rules yet — add some first.'
                : ev.isPerfect
                  ? `Perfect day — all ${ev.eligibleCount} items done.`
                  : `${ev.completedCount} of ${ev.eligibleCount} items · ${ev.eligibleCount - ev.completedCount} remaining`}
            </p>
            {ev.ruleEligible > 0 && (
              <p className="small secondary" style={{ marginTop: 2 }}>
                {ev.habitDone}/{ev.habitEligible} habits · {ev.ruleFollowed}/{ev.ruleEligible} rules followed
              </p>
            )}
          </div>

          {/* Optional daily note */}
          <div className="card">
            <div className="card-title"><span>Daily note</span><IconNote size={14} /></div>
            <textarea
              className="textarea"
              style={{ minHeight: 90 }}
              placeholder="How did today go? (optional)"
              value={noteValue}
              disabled={isFuture}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Daily note"
            />
            {noteDirty && (
              <div className="row-between" style={{ marginTop: 10 }}>
                <span className="small muted">Unsaved</span>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-sm" onClick={() => setNote(null)}>Discard</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveNote}>Save note</button>
                </div>
              </div>
            )}
          </div>

          {/* Jump to day */}
          <div className="card">
            <div className="card-title">Jump to day</div>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                type="number"
                min={1}
                max={arc.durationDays}
                placeholder={`1–${arc.durationDays}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') jumpToDay((e.target as HTMLInputElement).value);
                }}
                aria-label="Day number to jump to"
                style={{ minHeight: 40 }}
              />
              <button
                type="button"
                className="btn"
                onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                  jumpToDay(input.value);
                  input.value = '';
                }}
              >
                Go
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmJump && (
        <ConfirmModal
          title="View a future day?"
          message={`Future days can't be completed. You'll see the plan for ${formatLong(confirmJump)} in read-only mode.`}
          confirmLabel="View day"
          onConfirm={() => { setViewDate(confirmJump); setNote(null); }}
          onClose={() => setConfirmJump(null)}
        />
      )}
    </div>
  );
}
