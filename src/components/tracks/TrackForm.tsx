import React, { useEffect, useMemo, useState } from 'react';
import type { Habit, Rule, Track } from '../../types';
import type { TrackDraft } from '../../hooks/useAppData';
import { Modal } from '../ui/Modal';
import { addDays, formatLong, isValidISO, todayISO } from '../../services/date';
import { IconPlus, IconTrash, IconDumbbell, IconShield } from '../icons';
import { IconFor } from '../../pages/Habits';

/* ============================================================
   TrackForm — define a personal track/challenge: name, purpose,
   start date, duration (presets or custom), auto end date, an
   optional emoji, plus the habits and rules included in it.

   There is no built-in challenge: "Winter Arc" is just one
   example a user can type.
   ============================================================ */

const DURATIONS = [30, 60, 90, 180, 365];
const EMOJI = ['❄️', '🔥', '💪', '📚', '🧠', '🏃', '🌱', '🎯', '⚡', '📈'];

export interface TrackFormPayload {
  draft: TrackDraft;
  habitIds: string[];
  ruleIds: string[];
  newRuleTexts: string[];
}

interface TrackFormProps {
  initial?: Track | null;
  habits: Habit[];
  rules: Rule[];
  /** Habits already in this track (edit mode). undefined → default include-all. */
  includedHabitIds?: Set<string>;
  includedRuleIds?: Set<string>;
  /** Show the inline "add a new rule" row (create flow only). */
  allowNewRules?: boolean;
  onSave: (payload: TrackFormPayload) => void;
  onCancel: () => void;
}

export function TrackForm({
  initial,
  habits,
  rules,
  includedHabitIds,
  includedRuleIds,
  allowNewRules = true,
  onSave,
  onCancel,
}: TrackFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [goal, setGoal] = useState(initial?.goal ?? '');
  const [why, setWhy] = useState(initial?.why ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [duration, setDuration] = useState<number>(initial?.durationDays ?? 90);
  const [customDuration, setCustomDuration] = useState(
    initial && !DURATIONS.includes(initial.durationDays) ? String(initial.durationDays) : ''
  );
  const [habitIds, setHabitIds] = useState<Set<string>>(
    () => includedHabitIds ?? new Set(habits.filter((h) => h.active).map((h) => h.id))
  );
  const [ruleIds, setRuleIds] = useState<Set<string>>(
    () => includedRuleIds ?? new Set(rules.filter((r) => r.active).map((r) => r.id))
  );
  const [newRules, setNewRules] = useState<string[]>([]);
  const [newRuleText, setNewRuleText] = useState('');

  useEffect(() => {
    if (!initial) return;
    setTitle(initial.title);
    setDescription(initial.description);
    setIcon(initial.icon);
    setGoal(initial.goal);
    setWhy(initial.why);
    setStartDate(initial.startDate);
    setDuration(initial.durationDays);
    setCustomDuration(DURATIONS.includes(initial.durationDays) ? '' : String(initial.durationDays));
  }, [initial]);

  const isCustom = customDuration.trim().length > 0;
  const effectiveDuration = useMemo(() => {
    if (isCustom) {
      const n = Math.floor(Number(customDuration));
      return Number.isFinite(n) && n >= 1 ? n : 0;
    }
    return duration;
  }, [isCustom, customDuration, duration]);

  const endDate = startDate && effectiveDuration > 0 ? addDays(startDate, effectiveDuration - 1) : '';
  const titleOk = title.trim().length > 0;
  const dateOk = isValidISO(startDate);
  const durationOk = effectiveDuration >= 1 && effectiveDuration <= 3650;
  const canSave = titleOk && dateOk && durationOk;

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const addNewRule = () => {
    const text = newRuleText.trim();
    if (!text) return;
    setNewRules((prev) => [...prev, text]);
    setNewRuleText('');
  };

  const submit = () => {
    if (!canSave) return;
    onSave({
      draft: {
        title: title.trim(),
        description: description.trim(),
        icon: icon.trim(),
        startDate,
        durationDays: effectiveDuration,
        goal: goal.trim(),
        why: why.trim(),
      },
      habitIds: Array.from(habitIds),
      ruleIds: Array.from(ruleIds),
      newRuleTexts: newRules,
    });
  };

  return (
    <Modal
      title={initial ? 'Edit track' : 'Create track'}
      onClose={onCancel}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={submit}>
            {initial ? 'Save track' : 'Create track'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="tf-title">Track name *</label>
        <input
          id="tf-title"
          className="input"
          placeholder="e.g. Winter Arc, Fitness Journey, DSA Mastery"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="tf-desc">Description / purpose</label>
        <textarea
          id="tf-desc"
          className="textarea"
          placeholder="What is this track about? (optional)"
          value={description}
          maxLength={240}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="tf-icon">Icon / emoji (optional)</label>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className={`btn btn-icon${icon === e ? ' btn-primary' : ''}`}
              onClick={() => setIcon(icon === e ? '' : e)}
              aria-pressed={icon === e}
              aria-label={`Track emoji ${e}`}
            >
              <span style={{ fontSize: 16 }}>{e}</span>
            </button>
          ))}
        </div>
        <input
          id="tf-icon"
          className="input"
          placeholder="Or type any emoji"
          value={icon}
          maxLength={4}
          onChange={(e) => setIcon(e.target.value)}
        />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="tf-start">Start date *</label>
          <input
            id="tf-start"
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => isValidISO(e.target.value) && setStartDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tf-custom">Custom duration (days)</label>
          <input
            id="tf-custom"
            type="number"
            className="input"
            min={1}
            max={3650}
            placeholder="e.g. 45"
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>Duration</label>
        <div className="segmented" role="group" aria-label="Track duration">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={!isCustom && duration === d ? 'active' : ''}
              onClick={() => {
                setDuration(d);
                setCustomDuration('');
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <p className="small muted">
        {endDate ? (
          <>
            Runs <strong style={{ color: 'var(--text)' }}>{formatLong(startDate)}</strong> →{' '}
            <strong style={{ color: 'var(--text)' }}>{formatLong(endDate)}</strong> · {effectiveDuration} days.
          </>
        ) : (
          'Choose a start date and a valid duration.'
        )}
      </p>

      <div className="field">
        <label htmlFor="tf-goal">Goal</label>
        <input
          id="tf-goal"
          className="input"
          placeholder="What does finishing this track look like? (optional)"
          value={goal}
          maxLength={140}
          onChange={(e) => setGoal(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="tf-why">Why</label>
        <textarea
          id="tf-why"
          className="textarea"
          placeholder="Why does it matter? (optional)"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />
      </div>

      {/* ---------- Habits in this track ---------- */}
      <div className="field">
        <label className="row" style={{ gap: 6 }}><IconDumbbell size={14} /> Habits in this track</label>
        {habits.length === 0 ? (
          <p className="small muted">No habits yet — add some from the Habits page.</p>
        ) : (
          <div className="track-picks">
            {habits.map((h) => {
              const Icon = IconFor(h.icon);
              const on = habitIds.has(h.id);
              return (
                <label key={h.id} className={`track-pick${on ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setHabitIds((s) => toggle(s, h.id))}
                  />
                  <span className="track-pick-icon"><Icon size={13} /></span>
                  <span className="truncate">{h.name}{!h.active ? ' (archived)' : ''}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Rules in this track ---------- */}
      <div className="field">
        <label className="row" style={{ gap: 6 }}><IconShield size={14} /> Rules in this track</label>
        {rules.length === 0 && newRules.length === 0 ? (
          <p className="small muted">No rules yet — add one below.</p>
        ) : (
          <div className="track-picks">
            {rules.map((r) => {
              const on = ruleIds.has(r.id);
              return (
                <label key={r.id} className={`track-pick${on ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setRuleIds((s) => toggle(s, r.id))}
                  />
                  <span className="truncate">{r.text}{!r.active ? ' (archived)' : ''}</span>
                </label>
              );
            })}
            {newRules.map((text, i) => (
              <span key={`${text}-${i}`} className="track-pick on">
                <span className="truncate">{text}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => setNewRules((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove new rule ${text}`}
                >
                  <IconTrash size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        {allowNewRules && (
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="input"
              style={{ minHeight: 40 }}
              placeholder="e.g. No screens after 10 PM"
              value={newRuleText}
              maxLength={120}
              onChange={(e) => setNewRuleText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewRule(); } }}
              aria-label="New rule for this track"
            />
            <button type="button" className="btn" onClick={addNewRule} disabled={!newRuleText.trim()}>
              <IconPlus size={14} /> Add
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
