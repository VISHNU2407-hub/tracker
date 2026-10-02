import React, { useMemo, useState } from 'react';
import type { Arc, HabitType } from '../types';
import { addDays, formatLong, todayISO, isValidISO } from '../services/date';
import type { AppDataApi } from '../hooks/useAppData';
import {
  IconPlus, IconTrash, IconCheck, IconClock, IconHash,
} from '../components/icons';

/* ============================================================
   Onboarding wizard (first run only):
   Welcome → Track → Identity → Rules → Habits → Finish

   The Life System is year-round; the first step creates the
   user's FIRST TRACK (a challenge inside it). Nothing is
   hard-coded — "Winter Arc" is just an example name.
   ============================================================ */

const STEPS = ['Welcome', 'Track', 'Identity', 'Rules', 'Habits', 'Finish'];
const DURATIONS = [30, 60, 90, 180, 365];
const EMOJI = ['❄️', '🔥', '💪', '📚', '🧠', '🏃', '🌱', '🎯', '⚡', '📈'];

interface HabitDraft {
  name: string;
  icon: string;
  type: HabitType;
  target: number;
  unit: string;
  enabled: boolean;
}

const EXAMPLE_HABITS: HabitDraft[] = [
  { name: 'Workout', icon: 'dumbbell', type: 'checkbox', target: 1, unit: 'session', enabled: true },
  { name: 'Drink water', icon: 'hash', type: 'numeric', target: 8, unit: 'glasses', enabled: true },
  { name: 'Deep work', icon: 'clock', type: 'duration', target: 90, unit: 'min', enabled: true },
  { name: 'Read', icon: 'book', type: 'duration', target: 20, unit: 'min', enabled: false },
  { name: 'Sleep by 11pm', icon: 'check', type: 'checkbox', target: 1, unit: '', enabled: false },
];

function defaultTrack(): Arc {
  const startDate = todayISO();
  return {
    id: 'track_current',
    title: '',
    description: '',
    icon: '',
    startDate,
    endDate: addDays(startDate, 89),
    durationDays: 90,
    goal: '',
    why: '',
    rules: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function Onboarding({ api }: { api: AppDataApi }) {
  const [step, setStep] = useState(0);
  const [track, setTrack] = useState<Arc>(defaultTrack);
  const [rules, setRules] = useState<string[]>(['']);
  const [habits, setHabits] = useState<HabitDraft[]>(EXAMPLE_HABITS);

  const canNext = useMemo(() => {
    if (step === 1) return track.title.trim().length > 0 && isValidISO(track.startDate) && track.durationDays >= 1 && track.durationDays <= 3650;
    if (step === 4) return habits.some((h) => h.enabled && h.name.trim().length > 0);
    return true;
  }, [step, track, habits]);

  const finish = () => {
    const habitDefs = habits
      .filter((h) => h.enabled && h.name.trim())
      .map((h) => ({
        name: h.name.trim(),
        icon: h.icon,
        type: h.type,
        target: h.target,
        unit: h.unit,
      }));
    const cleanedRules = rules.map((r) => r.trim()).filter(Boolean);
    api.completeOnboarding(
      { ...track, title: track.title.trim(), goal: track.goal.trim(), why: track.why.trim(), rules: cleanedRules },
      habitDefs,
      cleanedRules
    );
  };

  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="onboard-steps" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`onboard-step-dot${i <= step ? ' active' : ''}`} />
          ))}
        </div>

        {step === 0 && <Welcome onContinue={() => setStep(1)} />}
        {step === 1 && (
          <TrackSetup track={track} onChange={setTrack} onBack={() => setStep(0)} onNext={() => setStep(2)} canNext={canNext} />
        )}
        {step === 2 && (
          <Identity track={track} onChange={setTrack} onBack={() => setStep(1)} onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <Rules rules={rules} onChange={setRules} onBack={() => setStep(2)} onNext={() => setStep(4)} />
        )}
        {step === 4 && (
          <Habits habits={habits} onChange={setHabits} onBack={() => setStep(3)} onNext={() => setStep(5)} canNext={canNext} />
        )}
        {step === 5 && (
          <Finish track={track} habits={habits.filter((h) => h.enabled && h.name.trim())} onBack={() => setStep(4)} onFinish={finish} />
        )}
      </div>
    </div>
  );
}

/* ---------- Step 1: Welcome ---------- */

function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div>
      <div className="onboard-kicker">Your Life. Your Progress. Your System.</div>
      <h1>Welcome to Life System</h1>
      <p className="lead">
        A private, local-first system for year-round personal growth. Track habits you do and rules
        you control, then create <strong>Tracks</strong> — challenges with a start date and a duration.
        Everything stays in this browser.
      </p>
      <ul className="secondary" style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 14, display: 'grid', gap: 6 }}>
        <li>Create any track you want — no fixed challenge</li>
        <li>Checkbox, numeric and duration habits</li>
        <li>Streaks, perfect days and honest analytics per track</li>
        <li>Weekly reflections and JSON backup</li>
      </ul>
      <div className="onboard-actions">
        <span />
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Create my first track
        </button>
      </div>
    </div>
  );
}

/* ---------- Step 2: Track ---------- */

function TrackSetup({
  track, onChange, onBack, onNext, canNext,
}: {
  track: Arc;
  onChange: (a: Arc) => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  const update = (patch: Partial<Arc>) => onChange({ ...track, ...patch });
  const end = addDays(track.startDate, track.durationDays - 1);
  const isCustom = !DURATIONS.includes(track.durationDays);

  return (
    <div>
      <div className="onboard-kicker">Step 1 · Track</div>
      <h1>Create your first track</h1>
      <p className="lead">A track is a challenge inside your continuous Life System — 90 days is a common default, but any length works.</p>

      <div className="field">
        <label htmlFor="ob-title">Track name *</label>
        <input
          id="ob-title"
          className="input"
          placeholder="Winter Arc, Fitness Journey, Coding Challenge…"
          value={track.title}
          maxLength={60}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="ob-desc">Description / purpose</label>
        <textarea
          id="ob-desc"
          className="textarea"
          placeholder="What is this track about? (optional)"
          value={track.description}
          maxLength={240}
          onChange={(e) => update({ description: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Icon / emoji (optional)</label>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className={`btn btn-icon${track.icon === e ? ' btn-primary' : ''}`}
              onClick={() => update({ icon: track.icon === e ? '' : e })}
              aria-pressed={track.icon === e}
              aria-label={`Track emoji ${e}`}
            >
              <span style={{ fontSize: 16 }}>{e}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ob-start">Start date</label>
        <input
          id="ob-start"
          type="date"
          className="input"
          value={track.startDate}
          max={addDays(todayISO(), 3650)}
          onChange={(e) => {
            const v = e.target.value;
            if (isValidISO(v)) update({ startDate: v, endDate: addDays(v, track.durationDays - 1) });
          }}
        />
      </div>

      <div className="field">
        <label>Duration</label>
        <div className="segmented" role="group" aria-label="Track duration">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={!isCustom && track.durationDays === d ? 'active' : ''}
              onClick={() => update({ durationDays: d, endDate: addDays(track.startDate, d - 1) })}
            >
              {d}d
            </button>
          ))}
        </div>
        <input
          className="input"
          style={{ marginTop: 8 }}
          type="number"
          min={1}
          max={3650}
          placeholder="Custom duration (days) — e.g. 45"
          value={isCustom ? track.durationDays : ''}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            if (n >= 1 && n <= 3650) update({ durationDays: n, endDate: addDays(track.startDate, n - 1) });
          }}
          aria-label="Custom duration in days"
        />
      </div>

      <p className="small muted">
        Your track runs <strong style={{ color: 'var(--text)' }}>{formatLong(track.startDate)}</strong> →{' '}
        <strong style={{ color: 'var(--text)' }}>{formatLong(end)}</strong>.
      </p>

      <div className="onboard-actions">
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" disabled={!canNext} onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

/* ---------- Step 3: Identity ---------- */

function Identity({
  track, onChange, onBack, onNext,
}: {
  track: Arc;
  onChange: (a: Arc) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="onboard-kicker">Step 2 · Identity</div>
      <h1>Give it a direction</h1>
      <p className="lead">What does finishing this track mean for you? You can edit this later without losing history.</p>

      <div className="field">
        <label htmlFor="ob-goal">Goal</label>
        <input
          id="ob-goal"
          className="input"
          placeholder="e.g. Build the discipline to run a half marathon"
          value={track.goal}
          onChange={(e) => onChange({ ...track, goal: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="ob-why">Why</label>
        <textarea
          id="ob-why"
          className="textarea"
          placeholder="Why does this matter to you? Read this on the hard days."
          value={track.why}
          onChange={(e) => onChange({ ...track, why: e.target.value })}
        />
      </div>

      <div className="onboard-actions">
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

/* ---------- Step 4: Rules ---------- */

function Rules({
  rules, onChange, onBack, onNext,
}: {
  rules: string[];
  onChange: (r: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const setRule = (i: number, v: string) => onChange(rules.map((r, idx) => (idx === i ? v : r)));
  const add = () => onChange([...rules, '']);
  const remove = (i: number) => onChange(rules.filter((_, idx) => idx !== i));
  const count = rules.filter((r) => r.trim()).length;

  return (
    <div>
      <div className="onboard-kicker">Step 3 · Rules</div>
      <h1>Your personal rules</h1>
      <p className="lead">
        3–7 short, non-negotiable rules for your track. Rules are things you want to follow,
        avoid or control — they become daily check-ins next to your habits. Optional — skip if you prefer.
      </p>

      <div className="rules-editor">
        {rules.map((r, i) => (
          <div className="rule-row" key={i}>
            <span className="muted small" style={{ width: 18, textAlign: 'right' }}>{i + 1}.</span>
            <input
              className="input"
              style={{ minHeight: 40 }}
              placeholder="e.g. No phone during the first hour"
              value={r}
              maxLength={120}
              onChange={(e) => setRule(i, e.target.value)}
              aria-label={`Rule ${i + 1}`}
            />
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => remove(i)} aria-label={`Remove rule ${i + 1}`}>
              <IconTrash size={15} />
            </button>
          </div>
        ))}
      </div>

      {rules.length < 7 && (
        <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={add}>
          <IconPlus size={14} /> Add rule
        </button>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>{count} rule{count === 1 ? '' : 's'} will be saved.</p>

      <div className="onboard-actions">
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

/* ---------- Step 5: Habits ---------- */

function Habits({
  habits, onChange, onBack, onNext, canNext,
}: {
  habits: HabitDraft[];
  onChange: (h: HabitDraft[]) => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  const update = (i: number, patch: Partial<HabitDraft>) =>
    onChange(habits.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));

  const typeIcon = (t: HabitType) => (t === 'duration' ? <IconClock size={14} /> : t === 'numeric' ? <IconHash size={14} /> : <IconCheck size={14} />);

  const setEnabled = (i: number, enabled: boolean) => {
    update(i, { enabled });
    if (!enabled) return;
    const h = habits[i];
    if (h.type === 'duration' && !h.target) update(i, { target: 30, unit: 'min' });
  };

  return (
    <div>
      <div className="onboard-kicker">Step 4 · Habits</div>
      <h1>Choose your daily habits</h1>
      <p className="lead">Examples are pre-filled and fully editable. Enable at least one — you decide the actual targets.</p>

      <div className="example-habits">
        {habits.map((h, i) => (
          <div className="example-habit" key={i}>
            <input
              type="checkbox"
              checked={h.enabled}
              onChange={(e) => setEnabled(i, e.target.checked)}
              aria-label={`Include ${h.name}`}
              style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
            />
            <input
              className="input"
              style={{ minHeight: 36, flex: 1, minWidth: 0 }}
              value={h.name}
              onChange={(e) => update(i, { name: e.target.value })}
              aria-label={`Name of habit ${i + 1}`}
              maxLength={60}
            />
            <select
              className="select"
              style={{ minHeight: 36, width: 110, fontSize: 12.5 }}
              value={h.type}
              onChange={(e) => {
                const type = e.target.value as HabitType;
                const unit = type === 'duration' ? 'min' : type === 'numeric' ? '×' : 'session';
                update(i, { type, unit, target: type === 'checkbox' ? 1 : h.target || 1 });
              }}
              aria-label={`Type of habit ${h.name}`}
            >
              <option value="checkbox">Checkbox</option>
              <option value="numeric">Numeric</option>
              <option value="duration">Duration</option>
            </select>
            {h.type !== 'checkbox' && (
              <input
                className="input"
                style={{ minHeight: 36, width: 74 }}
                type="number"
                min={1}
                value={h.target || ''}
                onChange={(e) => update(i, { target: Math.max(1, Number(e.target.value) || 0) })}
                aria-label={`Target for ${h.name}`}
              />
            )}
            {h.type !== 'checkbox' && (
              <input
                className="input"
                style={{ minHeight: 36, width: 84 }}
                value={h.unit}
                maxLength={12}
                onChange={(e) => update(i, { unit: e.target.value })}
                aria-label={`Unit for ${h.name}`}
                placeholder="unit"
              />
            )}
            <span className="muted" title="Habit type">{typeIcon(h.type)}</span>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-sm" onClick={() => onChange([...habits, { name: '', icon: 'target', type: 'checkbox', target: 1, unit: '', enabled: true }])}>
        <IconPlus size={14} /> Add another habit
      </button>

      <div className="onboard-actions">
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" disabled={!canNext} onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

/* ---------- Step 6: Finish ---------- */

function Finish({
  track, habits, onBack, onFinish,
}: {
  track: Arc;
  habits: HabitDraft[];
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div>
      <div className="onboard-kicker">Final step</div>
      <h1>Your track is ready</h1>
      <p className="lead">
        <strong>{track.title}</strong> · {formatLong(track.startDate)} → {formatLong(track.endDate)} ·{' '}
        {track.durationDays} days · {habits.length} habit{habits.length === 1 ? '' : 's'}. Everything is stored locally in this browser.
      </p>
      <ul className="secondary" style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 14, display: 'grid', gap: 6 }}>
        <li>Your Life System is continuous — create more tracks any time.</li>
        <li>Habits and rules you add now belong to this track.</li>
        <li>Only today is editable; past days stay as read-only history.</li>
      </ul>
      <div className="onboard-actions">
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" onClick={onFinish}>
          <IconCheck size={15} /> Open Day 1
        </button>
      </div>
    </div>
  );
}
