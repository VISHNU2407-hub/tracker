import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { useAnalytics, trackScope } from '../hooks/useArc';
import type { PageId } from '../hooks/useArc';
import { PageHeader } from '../app/layout/PageHeader';
import { DayTasks } from '../components/dashboard/DayTasks';
import { ProgressRing } from '../components/ui/ProgressRing';
import { ConfirmModal } from '../components/ui/Modal';
import {
  IconChevronLeft, IconChevronRight, IconLock, IconNote,
  IconShield, IconDumbbell, IconFlame,
} from '../components/icons';
import { addDays, dayNumber, formatLong, todayISO } from '../services/date';

/* ============================================================
   Today page: focused daily view with a scrollable Arc day
   strip. Only today is editable — previous days are read-only
   history, future days are locked until they arrive.
   ============================================================ */

export function TodayPage({ api, onNavigate }: { api: AppDataApi; onNavigate: (p: PageId) => void }) {
  const { data } = api;
  const arc = data.arc!;
  const today = todayISO();
  const { evaluate } = useAnalytics(data);
  const { habits: scopedHabits, rules: scopedRules } = trackScope(data);

  const [viewDate, setViewDate] = useState<string>(today);
  const [note, setNote] = useState<string | null>(null);
  const [confirmJump, setConfirmJump] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const jumpRef = useRef<HTMLInputElement | null>(null);

  // Clamp to the track window. Future days stay viewable (read-only below);
  // only days before the track starts get pulled up to Day 1.
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
  const dayNo = dayNumber(clamped, arc.startDate, arc.durationDays);

  const noteValue = note ?? rec?.note ?? '';
  const noteDirty = note !== null && note !== (rec?.note ?? '');

  // Every track day with a compact completion state for the strip.
  const arcDays = useMemo(
    () => Array.from({ length: arc.durationDays }, (_, i) => addDays(arc.startDate, i)),
    [arc.startDate, arc.durationDays],
  );

  // Keep the selected day visible when navigating with arrows.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [clamped]);

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
    if (target > today) {
      setConfirmJump(target); // future days need explicit confirmation
    } else {
      goto(target);
    }
  };

  const lastArcDay = addDays(arc.startDate, arc.durationDays - 1);

  return (
    <div>
      <PageHeader
        title={isToday ? 'Today' : `Day ${dayNo}`}
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

      {/* ---------- Track day strip ---------- */}
      <div className="card daystrip-card">
        <div className="daystrip-head">
          <span className="card-title">
            <span>Day {dayNo} of {arc.durationDays}</span>
            {isFuture && (
              <span className="pill pill-lock"><IconLock size={12} /> Locked</span>
            )}
            {isPast && (
              <span className="pill pill-lock"><IconLock size={12} /> Read only</span>
            )}
            {isToday && <span className="pill pill-today">Today</span>}
          </span>
          <div className="daystrip-jump">
            <input
              className="input input-sm"
              ref={jumpRef}
              type="number"
              min={1}
              max={arc.durationDays}
              placeholder="Day #"
              onKeyDown={(e) => {
                if (e.key === 'Enter') jumpToDay((e.target as HTMLInputElement).value);
              }}
              aria-label="Day number to jump to"
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                const input = jumpRef.current;
                jumpToDay(input?.value ?? '');
                if (input) input.value = '';
              }}
            >
              Go
            </button>
          </div>
        </div>

        <div className="daystrip" ref={stripRef} role="group" aria-label="Track days">
          {arcDays.map((d) => {
            const dEval = evaluate(d);
            const pct = dEval?.pct ?? null;
            const state = pct === null ? 'none' : pct >= 100 ? 'full' : pct > 0 ? 'part' : 'miss';
            return (
              <button
                key={d}
                type="button"
                data-active={d === clamped}
                aria-pressed={d === clamped}
                className={`daystrip-cell state-${state}${d === clamped ? ' active' : ''}${d === today ? ' is-today' : ''}${d > today ? ' future' : ''}`}
                onClick={() => goto(d)}
                title={`Day ${dayNumber(d, arc.startDate, arc.durationDays)} · ${pct === null ? 'no trackables' : `${pct}% complete`}`}
              >
                <span className="daystrip-n">{dayNumber(d, arc.startDate, arc.durationDays)}</span>
                <span className="daystrip-dot" />
              </button>
            );
          })}
        </div>
      </div>

      {isPast && (
        <div className="notice notice-info" role="status">
          <IconLock size={15} />
          <span>
            You are viewing a <strong>past day</strong>. It is <strong>read only</strong> —
            only today can be updated.
          </span>
        </div>
      )}

      {isFuture && (
        <div className="notice notice-info" role="status">
          <IconLock size={15} />
          <span>Viewing a <strong>future day</strong>. It becomes editable once this date arrives.</span>
        </div>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* ---------- Tracking ---------- */}
        <div className="card">
          <div className="card-title">
            <span className="card-title-main"><IconDumbbell size={15} /> Day {dayNo} tracking</span>
            {isFuture && (
              <span className="small muted row" style={{ gap: 5 }}>
                <IconLock size={13} /> Future
              </span>
            )}
            {isPast && (
              <span className="small muted row" style={{ gap: 5 }}>
                <IconLock size={13} /> Read only
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
              habits={scopedHabits}
              rules={scopedRules}
              records={data.dailyRecords}
              date={clamped}
              now={today}
              onToggle={api.toggleHabit}
              onSetValue={api.setHabitValue}
              onRuleStatus={api.setRuleStatus}
            />
          )}
        </div>

        {/* ---------- Right rail ---------- */}
        <div className="stack">
          <div className="card card-summary">
            <div className="card-title"><span>Day progress</span></div>
            <div className="today-ring">
              <ProgressRing
                pct={ev.pct}
                size={132}
                stroke={11}
                label={`Day ${dayNo}`}
              />
            </div>
            <p className="small muted center-text">
              {ev.pct === null
                ? 'No eligible habits or rules yet - add some first.'
                : ev.isPerfect
                  ? `Perfect day - all ${ev.eligibleCount} items done.`
                  : `${ev.completedCount} of ${ev.eligibleCount} done - ${ev.eligibleCount - ev.completedCount} to go`}
            </p>

            <div className="split-rows">
              <div className="split-row">
                <span className="split-key"><IconDumbbell size={13} /> Habits</span>
                <span className="split-val">
                  <span className="rate-bar"><span className="rate-bar-fill" style={{ width: `${ev.habitEligible ? (ev.habitDone / ev.habitEligible) * 100 : 0}%` }} /></span>
                  {ev.habitDone}/{ev.habitEligible}
                </span>
              </div>
              <div className="split-row">
                <span className="split-key rule"><IconShield size={13} /> Rules</span>
                <span className="split-val">
                  <span className="rate-bar"><span className="rate-bar-fill rule" style={{ width: `${ev.ruleEligible ? (ev.ruleFollowed / ev.ruleEligible) * 100 : 0}%` }} /></span>
                  {ev.ruleFollowed}/{ev.ruleEligible}
                </span>
              </div>
            </div>
          </div>

          {/* Optional daily note */}
          <div className="card">
            <div className="card-title">
              <span className="card-title-main"><IconNote size={15} /> Daily note</span>
              {!isToday && (
                <span className="small muted row" style={{ gap: 5 }}>
                  <IconLock size={13} /> Read only
                </span>
              )}
            </div>
            <textarea
              className="textarea"
              style={{ minHeight: 88 }}
              placeholder="How did today go? (optional)"
              value={noteValue}
              disabled={!isToday}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Daily note"
            />
            {isToday && noteDirty && (
              <div className="row-between" style={{ marginTop: 10 }}>
                <span className="small muted">Unsaved</span>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-sm" onClick={() => setNote(null)}>Discard</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveNote}>Save note</button>
                </div>
              </div>
            )}
            {!isToday && (
              <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
                Notes can only be written on today.
              </p>
            )}
          </div>

          <div className="card card-quiet">
            <div className="card-title"><span className="card-title-main"><IconFlame size={15} /> Keep the streak warm</span></div>
            <p className="small muted">
              Streaks count a day once every eligible habit and rule is done. Log a partial day honestly - it still counts.
            </p>
            <button type="button" className="btn btn-sm" onClick={() => onNavigate('habits')}>Manage habits</button>
            <button type="button" className="btn btn-sm" onClick={() => onNavigate('tracks')}>Manage rules</button>
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