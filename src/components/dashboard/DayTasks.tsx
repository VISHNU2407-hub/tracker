import React from 'react';
import type { Arc, DailyRecord, Habit, Rule } from '../../types';
import {
  eligibleHabitsForDate, eligibleRulesForDate, habitValueDone, ruleFollowed,
} from '../../services/analytics';
import { HabitProgressInput } from '../habits/HabitProgressInput';
import { IconCheck, IconLock, IconX, IconShield } from '../icons';
import { IconFor } from '../../pages/Habits';

/* ============================================================
   DayTasks — today's habits AND rules for a specific date.
   Habits = things you DID · Rules = things you CONTROLLED.
   Used by Dashboard, Today page and the DayDetail modal.
   Future days are protected (spec §3: no accidental completion).
   ============================================================ */

interface DayTasksProps {
  arc: Arc;
  habits: Habit[];
  rules: Rule[];
  records: Record<string, DailyRecord>;
  date: string;
  now: string;
  onToggle: (date: string, habitId: string) => void;
  onSetValue: (date: string, habitId: string, value: number) => void;
  onRuleStatus: (date: string, ruleId: string, status: 'followed' | 'not_followed' | null) => void;
  compact?: boolean;
}

export function DayTasks({
  arc, habits, rules, records, date, now, onToggle, onSetValue, onRuleStatus, compact,
}: DayTasksProps) {
  const isFuture = date > now;
  const eligible = eligibleHabitsForDate(habits, date, now);
  const elRules = eligibleRulesForDate(arc, rules, date, now);

  if (eligible.length === 0 && elRules.length === 0) {
    return (
      <div className="empty-state">
        <div className="big">Nothing to track on this day</div>
        <p>Add habits on the Habits page or rules in My Winter Arc.</p>
      </div>
    );
  }

  const habitsDone = eligible.filter((h) => habitValueDone(h, records[date]?.habits[h.id])).length;
  const rulesFollowed = elRules.filter((r) => ruleFollowed(r, records[date]?.rules?.[r.id])).length;

  return (
    <div className="stack" style={{ gap: compact ? 10 : 14 }}>
      {/* ---------- HABITS — what you DID ---------- */}
      {eligible.length > 0 && (
        <section>
          <div className="section-label">
            <span>Habits</span>
            <span className="section-label-hint">
              {habitsDone}/{eligible.length} done · what you did
            </span>
          </div>
          <div className="stack" style={{ gap: compact ? 8 : 10 }}>
            {eligible.map((habit) => {
              const rec = records[date]?.habits[habit.id];
              // Same rule as analytics: checkbox = stored flag, numeric/duration = value >= target.
              const done = habitValueDone(habit, rec);
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
        </section>
      )}

      {/* ---------- RULES — what you CONTROLLED ---------- */}
      {elRules.length > 0 && (
        <section>
          <div className="section-label">
            <span>Rules</span>
            <span className="section-label-hint">
              {rulesFollowed}/{elRules.length} followed · what you controlled
            </span>
          </div>
          <div className="stack" style={{ gap: compact ? 8 : 10 }}>
            {elRules.map((rule) => {
              const stored = records[date]?.rules?.[rule.id];
              const followed = ruleFollowed(rule, stored);
              return (
                <div className={`task-item rule-item${followed ? ' done' : ''}`} key={rule.id}>
                  <button
                    type="button"
                    className={`task-check${followed ? ' checked' : ''}`}
                    disabled={isFuture}
                    onClick={() => onRuleStatus(date, rule.id, followed ? null : 'followed')}
                    aria-pressed={followed}
                    aria-label={`${followed ? 'Unmark' : 'Mark'} followed: ${rule.text}`}
                  >
                    <IconCheck size={15} />
                  </button>

                  <span className="task-icon rule-icon"><IconShield size={16} /></span>

                  <div className="task-body">
                    <div className="task-name truncate">{rule.text}</div>
                    <div className="task-meta">Rule · {followed ? 'followed today' : 'kept yourself accountable?'}</div>
                    <div className="rule-status-row" role="group" aria-label={`Rule status: ${rule.text}`}>
                      <button
                        type="button"
                        className={`rule-status-btn followed${followed ? ' active' : ''}`}
                        disabled={isFuture}
                        onClick={() => onRuleStatus(date, rule.id, followed ? null : 'followed')}
                        aria-pressed={followed}
                      >
                        Followed
                      </button>
                      <button
                        type="button"
                        className={`rule-status-btn broken${stored?.status === 'not_followed' ? ' active' : ''}`}
                        disabled={isFuture}
                        onClick={() =>
                          onRuleStatus(date, rule.id, stored?.status === 'not_followed' ? null : 'not_followed')
                        }
                        aria-pressed={stored?.status === 'not_followed'}
                      >
                        <IconX size={12} /> Not followed
                      </button>
                    </div>
                  </div>

                  {isFuture && (
                    <span className="task-meta row" style={{ gap: 6 }}>
                      <IconLock size={13} /> Locked
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
