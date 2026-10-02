import React, { useMemo, useState } from 'react';
import type { Track } from '../types';
import type { AppDataApi } from '../hooks/useAppData';
import { PageHeader } from '../app/layout/PageHeader';
import { ConfirmModal } from '../components/ui/Modal';
import { TrackForm, type TrackFormPayload } from '../components/tracks/TrackForm';
import { addDays, formatDateRange, todayISO } from '../services/date';
import { computeOverallStats, isArcComplete } from '../services/analytics';
import { belongsToTrack } from '../services/storage';
import {
  IconPlus, IconTrash, IconCheck, IconRestore, IconShield, IconDown, IconUp,
  IconTarget, IconFlame, IconTrophy, IconSpark, IconEdit, IconCheckCircle,
} from '../components/icons';

/* ============================================================
   My Tracks — the user's personal challenges inside the
   continuous Life System. Create, activate, edit, complete and
   delete tracks; manage the active track's rules. No built-in
   challenge: Winter Arc is just one example of a track.
   ============================================================ */

function scoped<T extends { trackIds?: string[] }>(items: T[], trackId: string): T[] {
  return items.filter((i) => belongsToTrack(i.trackIds, trackId));
}

interface TrackSummary {
  dayNumber: number;
  totalPct: number | null;
  daysLeft: number;
  notStarted: boolean;
  complete: boolean;
  currentStreak: number;
  bestStreak: number;
  perfectDays: number;
  habitDone: number;
  habitEligible: number;
  rulePct: number | null;
}

function summarize(track: Track, data: AppDataApi['data'], today: string): TrackSummary {
  const habits = scoped(data.habits, track.id);
  const rules = scoped(data.rules, track.id);
  const stats = computeOverallStats(track, habits, rules, data.dailyRecords, today);
  const lastDay = addDays(track.startDate, track.durationDays - 1);
  const notStarted = today < track.startDate;
  const complete = isArcComplete(track, today);
  const dayNumber = stats.dayNumber;
  const daysLeft = notStarted
    ? Math.round((new Date(track.startDate).getTime() - new Date(today).getTime()) / 86_400_000)
    : Math.max(0, track.durationDays - dayNumber);

  // Today's habit tally + rule control.
  const todayHabits = habits.filter((h) => h.active || h.createdAt.slice(0, 10) <= today);
  const habitEligible = todayHabits.length;
  const habitDone = todayHabits.filter(
    (h) => data.dailyRecords[today]?.habits[h.id]?.completed === true
  ).length;
  let followed = 0;
  let ruleEligible = 0;
  for (const r of rules) {
    if (!r.active) continue;
    ruleEligible += 1;
    if (data.dailyRecords[today]?.rules?.[r.id]?.status === 'followed') followed += 1;
  }

  return {
    dayNumber,
    totalPct: stats.totalPct,
    daysLeft,
    notStarted,
    complete,
    currentStreak: stats.streaks.current,
    bestStreak: stats.streaks.best,
    perfectDays: stats.perfectDays,
    habitDone,
    habitEligible,
    rulePct: ruleEligible === 0 ? null : Math.round((followed / ruleEligible) * 100),
  };
}

export function MyTracksPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const today = todayISO();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Track | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Track | null>(null);

  const activeTracks = data.tracks.filter((t) => t.status === 'active');
  const otherTracks = data.tracks.filter((t) => t.status !== 'active');
  const activeTrack = data.arc;

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t: Track) => { setEditing(t); setFormOpen(true); };

  const saveForm = (payload: TrackFormPayload) => {
    if (editing) {
      api.updateTrack(editing.id, {
        title: payload.draft.title,
        description: payload.draft.description ?? '',
        icon: payload.draft.icon ?? '',
        startDate: payload.draft.startDate,
        durationDays: payload.draft.durationDays,
        goal: payload.draft.goal ?? '',
        why: payload.draft.why ?? '',
      });
      api.setTrackMembership(editing.id, payload.habitIds, payload.ruleIds);
    } else {
      api.createTrack(payload.draft, payload.habitIds, payload.ruleIds);
      // New rules typed in the form become rules of the freshly created track
      // (createTrack makes it active, so addRule scopes to it).
      payload.newRuleTexts.forEach((text) => api.addRule(text));
    }
    setFormOpen(false);
    setEditing(null);
  };

  const includedHabitIds = useMemo(
    () => (editing ? new Set(scoped(data.habits, editing.id).map((h) => h.id)) : undefined),
    [editing, data.habits]
  );
  const includedRuleIds = useMemo(
    () => (editing ? new Set(scoped(data.rules, editing.id).map((r) => r.id)) : undefined),
    [editing, data.rules]
  );

  return (
    <div>
      <PageHeader
        title="My Tracks"
        sub="Your personal challenges. The Life System never ends — tracks run inside it."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <IconPlus size={15} /> Create Track
          </button>
        }
      />

      {data.tracks.length === 0 && (
        <div className="card empty-state">
          <div className="big">No tracks yet</div>
          <p>Create your first track — Winter Arc, a fitness journey, a coding challenge, or anything you want.</p>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <IconPlus size={15} /> Create Track
          </button>
        </div>
      )}

      {activeTracks.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <div className="card-title">Active tracks</div>
          <div className="tracks-grid">
            {activeTracks.map((t) => (
              <TrackCard
                key={t.id}
                track={t}
                summary={summarize(t, data, today)}
                isActive={data.activeTrackId === t.id}
                onActivate={() => api.setActiveTrack(t.id)}
                onEdit={() => openEdit(t)}
                onComplete={() => api.setTrackStatus(t.id, 'completed')}
                onDelete={() => setConfirmDelete(t)}
              />
            ))}
          </div>
        </section>
      )}

      {otherTracks.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <div className="card-title">Completed &amp; archived</div>
          <div className="tracks-grid">
            {otherTracks.map((t) => (
              <TrackCard
                key={t.id}
                track={t}
                summary={summarize(t, data, today)}
                isActive={data.activeTrackId === t.id}
                onActivate={() => api.setActiveTrack(t.id)}
                onEdit={() => openEdit(t)}
                onReopen={() => api.setTrackStatus(t.id, 'active')}
                onDelete={() => setConfirmDelete(t)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Active track detail: goal, rules, status ---------- */}
      {activeTrack && <ActiveTrackEditor key={activeTrack.id} api={api} track={activeTrack} onEdit={() => openEdit(activeTrack)} />}

      {formOpen && (
        <TrackForm
          initial={editing}
          habits={data.habits}
          rules={data.rules}
          includedHabitIds={includedHabitIds}
          includedRuleIds={includedRuleIds}
          allowNewRules={!editing}
          onSave={saveForm}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete this track?"
          danger
          requireText="DELETE"
          message={
            <>
              This removes the track <strong>{confirmDelete.title}</strong> and its membership tag from habits and rules.
              Your daily records, habits and reflections are <strong>not</strong> deleted.
            </>
          }
          confirmLabel="Delete track"
          onConfirm={() => api.deleteTrack(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

/* ---------- Track card ---------- */

function TrackCard({
  track, summary, isActive, onActivate, onEdit, onComplete, onReopen, onDelete,
}: {
  track: Track;
  summary: TrackSummary;
  isActive: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onComplete?: () => void;
  onReopen?: () => void;
  onDelete: () => void;
}) {
  const progressPct = summary.notStarted
    ? 0
    : Math.min(100, Math.round((summary.dayNumber / track.durationDays) * 100));
  const statusLabel = summary.complete
    ? 'Complete'
    : track.status === 'archived'
      ? 'Archived'
      : track.status === 'completed'
        ? 'Completed'
        : isActive
          ? 'Active'
          : 'Paused';

  return (
    <div className={`track-card${isActive ? ' is-active' : ''}`}>
      <div className="track-card-top">
        <span className="track-icon" aria-hidden="true">{track.icon || <IconTarget size={16} />}</span>
        <div className="track-card-head">
          <div className="track-title truncate" title={track.title}>{track.title}</div>
          <div className="track-meta">
            {summary.notStarted
              ? `Starts in ${summary.daysLeft} day${summary.daysLeft === 1 ? '' : 's'}`
              : `Day ${summary.dayNumber} / ${track.durationDays}`}
            {' · '}{progressPct}% complete
          </div>
        </div>
        <span className={`track-badge${isActive ? ' on' : ''}`}>{statusLabel}</span>
      </div>

      {track.description && <p className="small secondary track-desc">{track.description}</p>}

      <div className="track-stat-row">
        <span className="track-stat"><IconFlame size={13} /> <strong>{summary.currentStreak}</strong> streak</span>
        <span className="track-stat"><IconTrophy size={13} /> <strong>{summary.bestStreak}</strong> best</span>
        <span className="track-stat"><IconSpark size={13} /> <strong>{summary.perfectDays}</strong> perfect</span>
        <span className="track-stat">
          <IconCheckCircle size={13} /> <strong>{summary.habitDone}/{summary.habitEligible}</strong> habits today
        </span>
        <span className="track-stat">
          <IconShield size={13} /> <strong>{summary.rulePct === null ? '—' : `${summary.rulePct}%`}</strong> rule control
        </span>
      </div>

      <div className="track-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${track.title} progress`}>
        <div className="track-bar-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="track-card-actions">
        {!isActive && (
          <button type="button" className="btn btn-sm" onClick={onActivate}>Activate</button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
          <IconEdit size={13} /> Edit
        </button>
        {onComplete && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onComplete}>
            <IconCheck size={13} /> Complete
          </button>
        )}
        {onReopen && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReopen}>
            <IconRestore size={13} /> Reopen
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-icon" onClick={onDelete} aria-label={`Delete ${track.title}`}>
          <IconTrash size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---------- Active track editor: goal & why + rules ---------- */

function ActiveTrackEditor({ api, track, onEdit }: { api: AppDataApi; track: Track; onEdit: () => void }) {
  const { data } = api;
  const [goal, setGoal] = useState(track.goal);
  const [why, setWhy] = useState(track.why);
  const [newRuleText, setNewRuleText] = useState('');
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<string | null>(null);

  const identityDirty = goal !== track.goal || why !== track.why;
  const lastDay = addDays(track.startDate, track.durationDays - 1);
  const complete = isArcComplete(track, todayISO());

  const rules = scoped(data.rules, track.id);
  const activeRules = rules.filter((r) => r.active).sort((a, b) => a.order - b.order);
  const archivedRules = rules.filter((r) => !r.active).sort((a, b) => a.order - b.order);

  const addRule = () => {
    const text = newRuleText.trim();
    if (!text) return;
    api.addRule(text);
    setNewRuleText('');
  };

  const moveRule = (id: string, dir: -1 | 1) => {
    const ids = activeRules.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    api.reorderRules(ids);
  };

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="card">
          <div className="card-title">
            <span>Editing: {track.title}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>Edit details</button>
          </div>
          <div className="kv-row"><span className="kv-key">Status</span><span className="kv-val">{complete ? 'Time is up' : track.status}</span></div>
          <div className="kv-row"><span className="kv-key">Dates</span><span className="kv-val">{formatDateRange(track.startDate, lastDay)}</span></div>
          <div className="kv-row"><span className="kv-key">Duration</span><span className="kv-val">{track.durationDays} days</span></div>
          <div className="kv-row"><span className="kv-key">Habits</span><span className="kv-val">{scoped(data.habits, track.id).filter((h) => h.active).length} active</span></div>
          <div className="kv-row"><span className="kv-key">Rules</span><span className="kv-val">{activeRules.length} active · {archivedRules.length} archived</span></div>
        </div>

        <div className="card">
          <div className="card-title">Goal &amp; Why</div>
          <div className="field">
            <label htmlFor="tr-goal">Goal</label>
            <input id="tr-goal" className="input" value={goal} maxLength={140} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="tr-why">Why</label>
            <textarea id="tr-why" className="textarea" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why does this track matter to you?" />
          </div>
          {identityDirty && (
            <div className="row-between" style={{ marginTop: 12 }}>
              <span className="small muted">Unsaved changes</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => api.updateTrack(track.id, { goal: goal.trim(), why: why.trim() })}
              >
                <IconCheck size={15} /> Save
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card card-rules">
        <div className="card-title">
          <span className="card-title-main rule"><IconShield size={14} /> Rules — daily trackable</span>
          <span className="pill">{activeRules.length} active</span>
        </div>
        <p className="small muted" style={{ marginBottom: 14 }}>
          Rules are things you want to <strong>follow, avoid or control</strong> — they appear in every
          day's checklist next to your habits and count toward your day's completion.
        </p>

        <div className="rules-editor">
          {activeRules.length === 0 && (
            <p className="small muted">No active rules yet — add your first below.</p>
          )}
          {activeRules.map((rule, idx) => (
            <div className="rule-row" key={rule.id}>
              <span className="mg-icon mg-rule-icon" title="Rule"><IconShield size={13} /></span>
              <input
                className="input"
                style={{ minHeight: 40 }}
                value={rule.text}
                maxLength={120}
                onChange={(e) => api.updateRule(rule.id, { text: e.target.value })}
                aria-label={`Rule ${idx + 1}`}
              />
              <button type="button" className="btn btn-ghost btn-icon" disabled={idx === 0} onClick={() => moveRule(rule.id, -1)} aria-label={`Move rule ${idx + 1} up`}>
                <IconUp size={14} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon" disabled={idx === activeRules.length - 1} onClick={() => moveRule(rule.id, 1)} aria-label={`Move rule ${idx + 1} down`}>
                <IconDown size={14} />
              </button>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => api.archiveRule(rule.id)} aria-label={`Archive rule ${idx + 1}`} title="Archive — past records stay intact">
                <IconTrash size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <input
            className="input"
            style={{ minHeight: 40 }}
            placeholder="e.g. No Instagram after 10 PM"
            value={newRuleText}
            maxLength={120}
            onChange={(e) => setNewRuleText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addRule(); }}
            aria-label="New rule text"
          />
          <button type="button" className="btn btn-primary" onClick={addRule} disabled={!newRuleText.trim()}>
            <IconPlus size={14} /> Add rule
          </button>
        </div>

        {archivedRules.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="section-label"><span>Archived rules — history preserved</span></div>
            {archivedRules.map((rule) => (
              <div className="rule-row" key={rule.id} style={{ opacity: 0.65 }}>
                <input className="input" style={{ minHeight: 36 }} value={rule.text} maxLength={120} disabled aria-label={`Archived rule ${rule.text}`} />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => api.restoreRule(rule.id)} aria-label="Restore rule" title="Restore to daily tracking">
                  <IconRestore size={14} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setConfirmDeleteRule(rule.id)} aria-label="Delete rule permanently">
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDeleteRule && (
        <ConfirmModal
          title="Delete rule permanently?"
          danger
          requireText="DELETE"
          message={
            <>
              This removes the rule <strong>and every followed/not-followed record</strong> for it.
              If you only want it off your daily checklist, archive it instead — archiving keeps history.
            </>
          }
          confirmLabel="Delete forever"
          onConfirm={() => api.deleteRulePermanently(confirmDeleteRule)}
          onClose={() => setConfirmDeleteRule(null)}
        />
      )}
    </div>
  );
}

