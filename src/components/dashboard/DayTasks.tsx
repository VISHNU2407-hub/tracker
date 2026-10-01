import React from 'react';
import type { Arc, DailyRecord, Habit } from '../../types';
import { eligibleHabitsForDate } from '../../services/analytics';
import { toggleHabitForDate, setHabitValueForDate } from '../habits/dayActions';
import { HabitProgressInput } from '../habits/HabitProgressInput';
import { IconCheck, IconLock } from '../icons';
import { IconFor } from '../../pages/Habits';

/* ============================================================
   DayTasks — today's habits for a specific date.
   Used by Dashboard, Today page and the DayDetail modal.
   Future days are protected (spec §3: no accidental completion).
   ============================================================ */

interface DayTasksProps {
  arc: Arc;
  habits: Habit[];
  records: Record<string, DailyRecord>;
  date: string;
  now: string;
  onToggle: (date: string, habitId: string) => void;
  onSetValue: (date: string, habitId: string, value: number) => void;
  compact?: boolean;
}

export function DayTasks({ arc, habits, records, date, now, onToggle, onSetValue, compact }: DayTasksProps) {
  const isFuture = date > now;
  const eligible = eligibleHabitsForDate(habits, date, now);

  if (eligible.length === 0) {
    return (
      <div className="empty-state">
        <div className="big">No habits for this day</div>
        <p>Add habits on the Habits page — they'll start counting from today.</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: compact ? 8 : 10 }}>
      {eligible.map((habit) => {
        const rec = records[date]?.habits[habit.id];
        const done = rec?.completed === true;
        const Icon = IconFor(habit.icon);

        return (
          <div className={`task-item${done ? ' done' : ''}`} key={habit.id}>
            <button
              type="button"
              className={`task-check${done ? ' checked' : ''}`}
              disabled={isFuture}
              onClick={() => onToggle(date, habit.id)}
              aria-pressed={done}
              aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: ${habit.name}`}
            >
              <IconCheck size={15} />
            </button>

            <span className="task-icon"><Icon size={16} /></span>

            <div className="task-body">
              <div className="task-name truncate">{habit.name}</div>
              <div className="task-meta">
                {habit.type === 'checkbox'
                  ? 'Simple check'
                  : habit.type === 'duration'
                    ? `${habit.target} min target`
                    : `${habit.target} ${habit.unit || ''} target`}
              </div>
            </div>

            {isFuture && (
              <span className="task-meta row" style={{ gap: 6 }}>
                <IconLock size={13} /> Locked
              </span>
            )}

            {!isFuture && habit.type !== 'checkbox' && (
              <HabitProgressInput
                value={rec?.value ?? 0}
                target={habit.target}
                unit={habit.unit}
                onCommit={(v) => onSetValue(date, habit.id, v)}
                label={habit.name}
              />
            )}

            {!isFuture && habit.type === 'checkbox' && !done && (
              <span className="task-meta">tap to complete</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Convenience wrappers so callers can pass the api functions directly. */
export function DayTasksWithApi(props: Omit<DayTasksProps, 'onToggle' | 'onSetValue'> & {
  toggle: (date: string, habitId: string) => void;
  setValue: (date: string, habitId: string, value: number) => void;
}) {
  return <DayTasks {...props} onToggle={props.toggle} onSetValue={props.setValue} />;
}
