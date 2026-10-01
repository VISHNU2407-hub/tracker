import React, { useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmModal } from '../components/ui/Modal';
import { ProgressRing } from '../components/ui/ProgressRing';
import {
  addDays, formatDateRange, formatLong, isValidISO, todayISO,
} from '../services/date';
import { isArcComplete } from '../services/analytics';
import { IconPlus, IconTrash, IconCheck } from '../components/icons';

/* ============================================================
   My Winter Arc (spec §3): goal, why, rules, dates, status.
   Edits never erase daily history. Date changes need confirmation.
   ============================================================ */

export function MyArcPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const arc = data.arc!;

  const [goal, setGoal] = useState(arc.goal);
  const [why, setWhy] = useState(arc.why);
  const [rules, setRules] = useState<string[]>(arc.rules.length ? arc.rules : ['']);
  const [startDate, setStartDate] = useState(arc.startDate);
  const [duration, setDuration] = useState(arc.durationDays);
  const [pendingDates, setPendingDates] = useState<null | { startDate: string; durationDays: number }>(null);

  const today = todayISO();
  const lastArcDay = addDays(arc.startDate, arc.durationDays - 1);
  const hasProgress = Object.keys(data.dailyRecords).length > 0;
  const arcComplete = isArcComplete(arc, today);

  const identityDirty =
    goal !== arc.goal || why !== arc.why ||
    JSON.stringify(rules.map((r) => r.trim()).filter(Boolean)) !== JSON.stringify(arc.rules);
  const datesDirty = startDate !== arc.startDate || duration !== arc.durationDays;

  const saveIdentity = () => {
    api.updateArc({
      goal: goal.trim(),
      why: why.trim(),
      rules: rules.map((r) => r.trim()).filter(Boolean),
    });
  };

  const requestDateChange = () => {
    const newEnd = addDays(startDate, duration - 1);
    if (!isValidISO(startDate)) return;
    const changesHistory =
      hasProgress &&
      (startDate !== arc.startDate || duration < arc.durationDays);
    if (changesHistory) {
      setPendingDates({ startDate, durationDays: duration });
    } else {
      // Safe change (no recorded days affected): apply immediately.
      api.updateArc({ startDate, durationDays: duration, endDate: newEnd });
    }
  };

  const applyDateChange = () => {
    if (!pendingDates) return;
    api.updateArc({
      startDate: pendingDates.startDate,
      durationDays: pendingDates.durationDays,
      endDate: addDays(pendingDates.startDate, pendingDates.durationDays - 1),
    });
    setPendingDates(null);
  };

  const daysElapsed = Math.max(0, Math.min(
    Math.round((new Date(today).getTime() - new Date(arc.startDate).getTime()) / 86_400_000) + 1,
    arc.durationDays
  ));

  return (
    <div>
      <PageHeader
        title="My Winter Arc"
        sub="Your identity and settings for this Arc. Edits never delete daily history."
      />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Overview card */}
        <div className="stack">
          <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
            <ProgressRing
              pct={Math.round((daysElapsed / arc.durationDays) * 100)}
              size={120}
              stroke={10}
              label="Arc elapsed"
            />
            <div className="row" style={{ marginTop: 12, gap: 14 }}>
              <span className="stat-value" style={{ fontSize: 22 }}>Day {Math.max(1, daysElapsed)}</span>
              <span className="muted">/ {arc.durationDays}</span>
            </div>
            <p className="small muted" style={{ marginTop: 6, textAlign: 'center' }}>
              {formatLong(arc.startDate)} → {formatLong(lastArcDay)}
            </p>
          </div>

          <div className="card">
            <div className="card-title">Status</div>
            <div className="kv-row"><span className="kv-key">Title</span><span className="kv-val">{arc.title}</span></div>
            <div className="kv-row"><span className="kv-key">Status</span><span className="kv-val success-text">{arcComplete ? 'completed' : arc.status}</span></div>
            <div className="kv-row"><span className="kv-key">Dates</span><span className="kv-val">{formatDateRange(arc.startDate, lastArcDay)}</span></div>
            <div className="kv-row"><span className="kv-key">Duration</span><span className="kv-val">{arc.durationDays} days</span></div>
            <div className="kv-row"><span className="kv-key">Habits</span><span className="kv-val">{data.habits.filter((h) => h.active).length} active · {data.habits.filter((h) => !h.active).length} archived</span></div>
            <div className="kv-row"><span className="kv-key">Recorded days</span><span className="kv-val">{Object.keys(data.dailyRecords).length}</span></div>
          </div>
        </div>

        {/* Editable identity */}
        <div className="stack">
          <div className="card">
            <div className="card-title">Goal & Why</div>
            <div className="field">
              <label htmlFor="ma-goal">Goal</label>
              <input id="ma-goal" className="input" value={goal} maxLength={140} onChange={(e) => setGoal(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="ma-why">Why</label>
              <textarea id="ma-why" className="textarea" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why does this Arc matter to you?" />
            </div>
          </div>

          <div className="card">
            <div className="card-title">Personal rules</div>
            <div className="rules-editor">
              {rules.map((r, i) => (
                <div className="rule-row" key={i}>
                  <span className="muted small" style={{ width: 18, textAlign: 'right' }}>{i + 1}.</span>
                  <input
                    className="input"
                    style={{ minHeight: 40 }}
                    value={r}
                    maxLength={120}
                    onChange={(e) => setRules(rules.map((x, idx) => (idx === i ? e.target.value : x)))}
                    aria-label={`Rule ${i + 1}`}
                  />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setRules(rules.filter((_, idx) => idx !== i))} aria-label={`Remove rule ${i + 1}`}>
                    <IconTrash size={15} />
                  </button>
                </div>
              ))}
            </div>
            {rules.length < 10 && (
              <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setRules([...rules, ''])}>
                <IconPlus size={14} /> Add rule
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-title">Dates</div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="ma-start">Start date</label>
                <input
                  id="ma-start"
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => isValidISO(e.target.value) && setStartDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="ma-duration">Duration (days)</label>
                <input
                  id="ma-duration"
                  type="number"
                  className="input"
                  min={7}
                  max={365}
                  value={duration}
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value));
                    if (n >= 7 && n <= 365) setDuration(n);
                  }}
                />
              </div>
            </div>
            <p className="small muted">
              New end date: <strong style={{ color: 'var(--text)' }}>{formatLong(addDays(startDate, duration - 1))}</strong>.
              {hasProgress && ' Changing dates with recorded progress requires confirmation.'}
            </p>
          </div>

          <div className="row-between">
            <span className="small muted">{identityDirty || datesDirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <div className="row" style={{ gap: 8 }}>
              {identityDirty && (
                <button type="button" className="btn btn-primary" onClick={saveIdentity}>
                  <IconCheck size={15} /> Save identity
                </button>
              )}
              {datesDirty && (
                <button type="button" className="btn" onClick={requestDateChange}>
                  Save dates
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {pendingDates && (
        <ConfirmModal
          title="Change Arc dates?"
          danger
          message={
            <>
              <p>You have recorded days under the current dates. Changing the start date or shortening the Arc can move or hide existing day records relative to the new window.</p>
              <p style={{ marginTop: 8 }}>
                New range: <strong>{formatDateRange(pendingDates.startDate, addDays(pendingDates.startDate, pendingDates.durationDays - 1))}</strong>
              </p>
              <p className="small muted" style={{ marginTop: 8 }}>
                Your daily records themselves are never deleted — but days outside the new Arc window won't count toward streaks or analytics.
              </p>
            </>
          }
          confirmLabel="Update dates"
          onConfirm={applyDateChange}
          onClose={() => setPendingDates(null)}
        />
      )}
    </div>
  );
}
