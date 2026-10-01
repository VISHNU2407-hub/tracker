import React, { useEffect, useState } from 'react';

/* ============================================================
   HabitProgressInput — numeric / duration entry control.
   Local string state lets users type freely (e.g. "0." or empty
   while editing); committed values persist immediately.
   ============================================================ */

interface HabitProgressInputProps {
  value: number;
  target: number;
  unit: string;
  disabled?: boolean;
  onCommit: (value: number) => void;
  label: string;
}

export function HabitProgressInput({ value, target, unit, disabled, onCommit, label }: HabitProgressInputProps) {
  const [text, setText] = useState(value > 0 ? String(value) : '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value > 0 ? String(value) : '');
  }, [value, focused]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n)) {
      onCommit(0);
      setText('');
      return;
    }
    const clamped = Math.max(0, Math.min(Math.round(n * 100) / 100, 1_000_000));
    onCommit(clamped);
    setText(clamped > 0 ? String(clamped) : '');
  };

  return (
    <div className="task-input">
      <input
        className="task-num-input"
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        disabled={disabled}
        value={text}
        placeholder="0"
        aria-label={`${label} — logged ${unit || 'value'} (target ${target})`}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) {
            onCommit(Math.max(0, n)); // live-persist valid numbers
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <span className="task-meta" style={{ minWidth: 64, textAlign: 'right' }}>
        {value} / {target} {unit}
      </span>
    </div>
  );
}
