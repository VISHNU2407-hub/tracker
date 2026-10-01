import React, { useMemo, useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmModal } from '../components/ui/Modal';
import {
  addDays, formatShort, todayISO, weekKeyOf, weekStartOf,
} from '../services/date';

/* ============================================================
   Reflection page (spec §3): weekly what went well / improve /
   next focus, stored by week key.
   ============================================================ */

export function ReflectionPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const arc = data.arc!;
  const today = todayISO();

  // The week being edited — clamped to the Arc window so the picker's value
  // is always one of the listed arc weeks (no default/state mismatch).
  const arcFirstWeek = weekStartOf(arc.startDate);
  const arcLastWeek = weekStartOf(addDays(arc.startDate, arc.durationDays - 1));
  const [weekStart, setWeekStart] = useState<string>(() => {
    const cur = weekStartOf(today);
    if (cur < arcFirstWeek) return arcFirstWeek;
    if (cur > arcLastWeek) return arcLastWeek;
    return cur;
  });
  const weekKey = weekKeyOf(weekStart);
  const existing = data.reflections[weekKey];

  const [wentWell, setWentWell] = useState<string | null>(null);
  const [toImprove, setToImprove] = useState<string | null>(null);
  const [nextFocus, setNextFocus] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset local edits when switching weeks
  React.useEffect(() => {
    setWentWell(null);
    setToImprove(null);
    setNextFocus(null);
  }, [weekKey]);

  const val = {
    wentWell: wentWell ?? existing?.wentWell ?? '',
    toImprove: toImprove ?? existing?.toImprove ?? '',
    nextFocus: nextFocus ?? existing?.nextFocus ?? '',
  };

  const dirty =
    val.wentWell !== (existing?.wentWell ?? '') ||
    val.toImprove !== (existing?.toImprove ?? '') ||
    val.nextFocus !== (existing?.nextFocus ?? '');

  const save = () => {
    api.saveReflection(weekKey, val);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  };

  const weekEnd = addDays(weekStart, 6);

  // Weeks inside the arc (for the picker)
  const arcWeeks = useMemo(() => {
    const out: { start: string; label: string }[] = [];
    let cursor = weekStartOf(arc.startDate);
    const last = weekStartOf(addDays(arc.startDate, arc.durationDays - 1));
    while (cursor <= last) {
      out.push({ start: cursor, label: `Week of ${formatShort(cursor)}` });
      cursor = addDays(cursor, 7);
    }
    return out;
  }, [arc.startDate, arc.durationDays]);

  // History: saved reflections, newest first
  const history = useMemo(
    () =>
      Object.values(data.reflections)
        .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)),
    [data.reflections]
  );

  return (
    <div>
      <PageHeader
        title="Reflection"
        sub="One honest check-in per week. Stored by week, kept forever."
      />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Editor */}
        <div className="card">
          <div className="card-title">
            <span>Week of {formatShort(weekStart)} – {formatShort(weekEnd)}</span>
            {existing && <span className="success-text small">saved</span>}
          </div>

          <div className="field">
            <label htmlFor="rf-week">Week</label>
            <select
              id="rf-week"
              className="select"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            >
              {arcWeeks.map((w) => (
                <option key={w.start} value={w.start}>{w.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="rf-well">What went well?</label>
            <textarea
              id="rf-well"
              className="textarea"
              placeholder="Wins, habits that clicked, moments you're proud of…"
              value={val.wentWell}
              onChange={(e) => setWentWell(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="rf-improve">What to improve?</label>
            <textarea
              id="rf-improve"
              className="textarea"
              placeholder="Missed days, weak spots, obstacles…"
              value={val.toImprove}
              onChange={(e) => setToImprove(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="rf-focus">Next week's focus</label>
            <textarea
              id="rf-focus"
              className="textarea"
              placeholder="One or two concrete adjustments for the coming week…"
              value={val.nextFocus}
              onChange={(e) => setNextFocus(e.target.value)}
            />
          </div>

          <div className="row-between">
            {existing ? (
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
                Delete entry
              </button>
            ) : (
              <span className="small muted">Autosaves only when you press save.</span>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!dirty}
              onClick={save}
            >
              {savedFlash ? 'Saved ✓' : existing ? 'Update entry' : 'Save entry'}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <div className="card-title">History ({history.length})</div>
          {history.length === 0 ? (
            <p className="secondary small">
              No reflections yet. At the end of each week, write what worked and what didn't — future you will thank you.
            </p>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {history.map((r) => (
                <div className="refl-card" key={r.weekKey}>
                  <div className="row-between">
                    <div className="refl-week">Week of {formatShort(r.weekStart)}</div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeekStart(r.weekStart)}>
                      Edit
                    </button>
                  </div>
                  {r.wentWell && (
                    <div className="refl-field"><strong>Went well</strong>{r.wentWell}</div>
                  )}
                  {r.toImprove && (
                    <div className="refl-field"><strong>To improve</strong>{r.toImprove}</div>
                  )}
                  {r.nextFocus && (
                    <div className="refl-field"><strong>Next focus</strong>{r.nextFocus}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete this reflection?"
          danger
          message={`This permanently removes the reflection for the week of ${formatShort(existing?.weekStart ?? weekStart)}.`}
          confirmLabel="Delete entry"
          onConfirm={() => {
            if (!existing) return;
            // Delete via save of empty values is wrong; use a dedicated removal.
            api.deleteReflection(existing.weekKey);
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
