import React, { useEffect, useState } from 'react';
import type { Habit, HabitType } from '../../types';
import { Modal } from '../ui/Modal';
import {
  IconDumbbell, IconBook, IconClock, IconHash, IconCheck, IconTarget, IconFlame, IconSpark, IconNote,
} from '../icons';

/* ============================================================
   HabitForm — add / edit a habit definition (spec §4).
   Editing a habit never touches stored daily records.
   ============================================================ */

interface IconOption {
  key: string;
  label: string;
  comp: React.FC<{ size?: number }>;
}

const ICON_OPTIONS: IconOption[] = [
  { key: 'dumbbell', label: 'Workout', comp: IconDumbbell },
  { key: 'book', label: 'Read', comp: IconBook },
  { key: 'clock', label: 'Time', comp: IconClock },
  { key: 'hash', label: 'Count', comp: IconHash },
  { key: 'check', label: 'Check', comp: IconCheck },
  { key: 'target', label: 'Target', comp: IconTarget },
  { key: 'flame', label: 'Fire', comp: IconFlame },
  { key: 'spark', label: 'Spark', comp: IconSpark },
  { key: 'note', label: 'Note', comp: IconNote },
];

export interface HabitFormValues {
  name: string;
  icon: string;
  type: HabitType;
  target: number;
  unit: string;
}

interface HabitFormProps {
  initial?: Habit | null;
  onSave: (values: HabitFormValues) => void;
  onCancel: () => void;
}

export function HabitForm({ initial, onSave, onCancel }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'target');
  const [type, setType] = useState<HabitType>(initial?.type ?? 'checkbox');
  const [target, setTarget] = useState(initial && initial.type !== 'checkbox' ? initial.target : 1);
  const [unit, setUnit] = useState(initial?.unit ?? '');

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setIcon(initial.icon);
      setType(initial.type);
      setTarget(initial.target);
      setUnit(initial.unit);
    }
  }, [initial]);

  const nameOk = name.trim().length > 0;
  const targetOk = type === 'checkbox' || (Number.isFinite(target) && target >= 1);

  const submit = () => {
    if (!nameOk || !targetOk) return;
    onSave({
      name: name.trim(),
      icon,
      type,
      target: type === 'checkbox' ? 1 : target,
      unit: type === 'checkbox' ? 'session' : unit.trim() || (type === 'duration' ? 'min' : '×'),
    });
  };

  return (
    <Modal
      title={initial ? 'Edit habit' : 'New habit'}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!nameOk || !targetOk} onClick={submit}>
            {initial ? 'Save changes' : 'Create habit'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="hf-name">Name *</label>
        <input
          id="hf-name"
          className="input"
          placeholder="e.g. Workout, Read, Meditate"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="field">
        <label>Type</label>
        <div className="segmented" role="group" aria-label="Habit type">
          {(['checkbox', 'numeric', 'duration'] as HabitType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={type === t ? 'active' : ''}
              onClick={() => setType(t)}
              title={
                t === 'checkbox'
                  ? 'Completed when checked'
                  : t === 'numeric'
                    ? 'Completed when actual ≥ target'
                    : 'Completed when minutes ≥ target'
              }
            >
              {t === 'checkbox' ? 'Checkbox' : t === 'numeric' ? 'Numeric' : 'Duration (min)'}
            </button>
          ))}
        </div>
        <span className="hint">
          {type === 'checkbox'
            ? 'Completed when checked.'
            : type === 'numeric'
              ? 'Enter a number each day; done when it reaches the target.'
              : 'Log minutes each day; done when they reach the target.'}
        </span>
      </div>

      {type !== 'checkbox' && (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="hf-target">{type === 'duration' ? 'Daily target (minutes)' : 'Daily target'}</label>
            <input
              id="hf-target"
              type="number"
              className="input"
              min={1}
              step={1}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
          </div>
          <div className="field">
            <label htmlFor="hf-unit">Unit</label>
            <input
              id="hf-unit"
              className="input"
              placeholder={type === 'duration' ? 'min' : 'glasses, pages, km…'}
              value={unit}
              maxLength={12}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="field">
        <label>Icon</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ICON_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`btn btn-icon${icon === o.key ? ' btn-primary' : ''}`}
              onClick={() => setIcon(o.key)}
              aria-label={`Icon: ${o.label}`}
              aria-pressed={icon === o.key}
              title={o.label}
            >
              <o.comp size={16} />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
