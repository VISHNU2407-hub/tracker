import React, { useMemo, useState } from 'react';
import type { Arc, HabitType } from '../types';
import { addDays, formatLong, todayISO, isValidISO } from '../services/date';
import { useAppData, type AppDataApi } from '../hooks/useAppData';
import {
  IconSnowflake, IconPlus, IconTrash, IconCheck, IconDumbbell, IconClock, IconHash,
} from '../components/icons';

/* ============================================================
   Onboarding wizard (spec §9):
   Welcome -> Arc Setup -> Identity -> Rules -> Habits -> Finish
   ============================================================ */

const STEPS = ['Welcome', 'Arc', 'Identity', 'Rules', 'Habits', 'Finish'];

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

function defaultArc(): Arc {
  const startDate = todayISO();
  return {
    id: 'arc_current',
    title: 'Winter Arc',
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
  const [arc, setArc] = useState<Arc>(defaultArc);
  const [rules, setRules] = useState<string[]>(['']);
  const [habits, setHabits] = useState<HabitDraft[]>(EXAMPLE_HABITS);

  const canNext = useMemo(() => {
    if (step === 1) return isValidISO(arc.startDate) && arc.durationDays >= 1 && arc.durationDays <= 365;
    if (step === 2) return arc.goal.trim().length > 0;
    if (step === 4) return habits.some((h) => h.enabled && h.name.trim().length > 0);
    return true;
  }, [step, arc, habits]);

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
      { ...arc, goal: arc.goal.trim(), why: arc.why.trim(), rules: cleanedRules },
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

        {step === 0 && (
          <Welcome onContinue={() => setStep(1)} />
        )}
        {step === 1 && (
          <ArcSetup
            arc={arc}
            onChange={setArc}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
            canNext={canNext}
          />
        )}
        {step === 2 && (
          <Identity
            arc={arc}
            onChange={setArc}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            canNext={canNext}
          />
        )}
        {step === 3 && (
          <Rules rules={rules} onChange={setRules} onBack={() => setStep(2)} onNext={() => setStep(4)} />
        )}
        {step === 4 && (
          <Habits
            habits={habits}
            onChange={setHabits}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
            canNext={canNext}
          />
        )}
        {step === 5 && (
          <Finish arc={arc} habits={habits.filter((h) => h.enabled && h.name.trim())} onBack={() => setStep(4)} onFinish={finish} />
        )}
      </div>
    </div>
  );
}

/* ---------- Step 1: Welcome ---------- */

function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div>
      <div className="onboard-kicker">90 days. One season. One version of you.</div>
      <h1>Welcome to Winter Arc</h1>
      <p className="lead">
        A private, local-first tracker for your 90-day self-improvement Arc. Define your goal,
        choose your habits, and check in every day. Everything stays in this browser — no account,
        no internet required.
      </p>
      <ul className="secondary" style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 14, display: 'grid', gap: 6 }}>
        <li>Pick your start date and track Day 1 → Day 90</li>
        <li>Checkbox, numeric and duration habits</li>
        <li>Streaks, perfect days and honest analytics</li>
        <li>Weekly reflections and JSON backup</li>
      </ul>
      <div className="onboard-actions">
        <span />
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Start My Arc
        </button>
      </div>
    </div>
  );
}

/* ---------- Step 2: Arc setup ---------- */

function ArcSetup({
  arc, onChange, onBack, onNext, canNext,
}: {
  arc: Arc;
  onChange: (a: Arc) => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  const update = (patch: Partial<Arc>) => onChange({ ...arc, ...patch });
  const end = addDays(arc.startDate, arc.durationDays - 1);

  return (
    <div>
      <div className="onboard-kicker">Step 1 · Arc</div>
      <h1>Set your Arc</h1>
      <p className="lead">The default is 90 days starting today. You can change the start date if you are beginning tomorrow.</p>

      <div className="field">
        <label htmlFor="ob-start">Start date</label>
        <input
          id="ob-start"
          type="date"
          className="input"
          value={arc.startDate}
          max={addDays(todayISO(), 3650)}
          onChange={(e) => {
            const v = e.target.value;
            if (isValidISO(v)) update({ startDate: v, endDate: addDays(v, arc.durationDays - 1) });
          }}
        />
      </div>

      <div className="field">
        <label>Duration</label>
        <div className="segmented" role="group" aria-label="Arc duration">
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={arc.durationDays === d ? 'active' : ''}
              onClick={() => update({ durationDays: d, endDate: addDays(arc.startDate, d - 1) })}
            >
              {d} days{d === 90 ? ' · default' : ''}
            </button>
          ))}
        </div>
      </div>

      <p className="small muted">
        Your Arc runs <strong style={{ color: 'var(--text)' }}>{formatLong(arc.startDate)}</strong> →{' '}
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
  arc, onChange, onBack, onNext, canNext,
}: {
  arc: Arc;
  onChange: (a: Arc) => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <div>
      <div className="onboard-kicker">Step 2 · Identity</div>
      <h1>Define your Arc</h1>
      <p className="lead">What does finishing this Winter Arc mean for you? You can edit this later without losing history.</p>

      <div className="field">
        <label htmlFor="ob-goal">Goal *</label>
        <input
          id="ob-goal"
          className="input"
          placeholder="e.g. Build the discipline to run a half marathon"
          value={arc.goal}
          onChange={(e) => onChange({ ...arc, goal: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="ob-why">Why</label>
        <textarea
          id="ob-why"
          className="textarea"
          placeholder="Why does this matter to you? Read this on the hard days."
          value={arc.why}
          onChange={(e) => onChange({ ...arc, why: e.target.value })}
        />
      </div>

      <div className="onboard-actions">
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" disabled={!canNext} onClick={onNext}>Continue</button>
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
        3–7 short, non-negotiable rules for the next {90} days. Rules are things you want to follow,
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
    // Give fresh habits a sensible default target if untouched
    const h = habits[i];
    if (h.type === 'duration' && !h.target) update(i, { target: 30, unit: 'min' });
  };

  return (
    <div>
      <div className="onboard-kicker">Step 4 · Habits</div>
      <h1>Choose your daily habits</h1>
      <p className="lead">Examples are pre-filled and fully editable. Enable at least one — the user decides the actual targets.</p>

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
  arc, habits, onBack, onFinish,
}: {
  arc: Arc;
  habits: HabitDraft[];
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div>
      <div className="onboard-kicker">Final step</div>
      <h1>Your Arc is ready</h1>
      <p className="lead">
        {formatLong(arc.startDate)} → {formatLong(arc.endDate)} · {arc.durationDays} days ·{' '}
        {habits.length} habit{habits.length === 1 ? '' : 's'}. Everything is stored locally in this browser.
      </p>

      <div className="card" style={{ background: 'var(--bg-raised)', boxShadow: 'none' }}>
        <div className="card-title">Goal</div>
        <p style={{ fontWeight: 600 }}>{arc.goal}</p>
        {arc.why && <p className="secondary small" style={{ marginTop: 8 }}>{arc.why}</p>}
        {arc.rules.filter((r) => r.trim()).length > 0 && (
          <>
            <div className="card-title" style={{ marginTop: 16 }}>Rules</div>
            <ul className="secondary small" style={{ margin: 0, paddingLeft: 18 }}>
              {arc.rules.filter((r) => r.trim()).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </>
        )}
      </div>

      <div className="onboard-actions">
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn btn-primary" onClick={onFinish}>
          <IconCheck size={15} /> Open Day 1
        </button>
      </div>
    </div>
  );
}
