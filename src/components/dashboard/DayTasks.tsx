import React from 'react';
import type { Arc, DailyRecord, Habit, Rule } from '../../types';
import {
  eligibleHabitsForDate, eligibleRulesForDate, habitValueDone, ruleFollowed,
} from '../../services/analytics';
import { HabitProgressInput } from '../habits/HabitProgressInput';
import { IconCheck, IconLock, IconX, IconShield, IconDumbbell, IconCheckCircle } from '../icons';
import { IconFor } from '../../pages/Habits';

/* ============================================================
   DayTasks - habits AND rules for a specific date.
   Habits = things you DID (icy blue). Rules = things you
   CONTROLLED (soft violet, pink when broken). Both feed the
   daily completion metrics.
   Only today is editable: previous days render read-only
   history (no controls), future days stay locked.
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

/** "45 min/day" · "8 pages/day" · "Done when checked" */
function targetLine(habit: Habit): string {
  if (habit.type === 'checkbox') return 'Simple check';
  if (habit.type === 'duration') return `${habit.target} min target`;
  return `${habit.target} ${habit.unit || ''} target`.trim();
}

export function DayTasks({
  arc, habits, rules, records, date, now, onToggle, onSetValue, onRuleStatus, compact,
}: DayTasksProps) {
  const isFuture = date > now;
  const isPast = date < now;
  // Single edit gate: today only. Everything else renders as read-only history.
  const editable = date === now;
  const lockLabel = isFuture ? 'Locked' : 'Read only';
  const lockTitle = isFuture
    ? 'Locked until this day arrives'
    : 'Read only — only today can be updated';
  const eligible = eligibleHabitsForDate(habits, date, now);
  const elRules = eligibleRulesForDate(arc, rules, date, now);

  if (eligible.length === 0 && elRules.length === 0) {
    return (
      <div className="empty-state">
        <div className="big">Nothing to track on this day</div>
        <p>Add habits on the Habits page or rules in My Tracks.</p>
      </div>
    );
  }

  const habitsDone = eligible.filter((h) => habitValueDone(h, records[date]?.habits[h.id])).length;
  const rulesFollowed = elRules.filter((r) => ruleFollowed(r, records[date]?.rules?.[r.id])).length;

  return (
    <div className="stack" style={{ gap: compact ? 12 : 16 }}>
      {/* ---------- HABITS - what you DID ---------- */}
      {eligible.length > 0 && (
        <section>
          <div className="section-label">
            <span className="section-label-habits">
              <IconDumbbell size={13} /> Habits
              <span className="section-label-tag">what you did</span>
            </span>
            <span className="section-label-hint">
              {habitsDone}/{eligible.length} done
            </span>
          </div>
          <div className="tasks-grid" style={{ gap: compact ? 8 : 10 }}>
            {eligible.map((habit) => {
              const rec = records[date]?.habits[habit.id];
              // Same rule as analytics: checkbox = stored flag, numeric/duration = value >= target.
              const done = habitValueDone(habit, rec);
              const Icon = IconFor(habit.icon);
              const pct = habit.target > 0 && habit.type !== 'checkbox'
                ? Math.min(100, Math.round(((rec?.value ?? 0) / habit.target) * 100))
                : null;

              return (
                <div className={`task-item${done ? ' done' : ''}`} key={habit.id}>
                  <span className="task-icon"><Icon size={16} /></span>

                  <div className="task-body">
                    <div className="task-name truncate">{habit.name}</div>
                    <div className="task-meta truncate">
                      {targetLine(habit)}
                      {editable && pct !== null && (
                        <span className={pct >= 100 ? ' success-text' : ''}> · {pct}%</span>
                      )}
                      {!editable && habit.type !== 'checkbox' && (
                        <span>
                          {' · '}{rec?.value ?? 0}/{habit.target}
                          {habit.unit ? ` ${habit.unit}` : ''}
                        </span>
                      )}
                      {isPast && (
                        <span className={done ? ' success-text' : ''}>
                          {' · '}{done ? 'Done' : 'Not done'}
                        </span>
                      )}
                    </div>
                  </div>

                  {editable ? (
                    <>
                      <button
                        type="button"
                        className={`task-check${done ? ' checked' : ''}`}
                        onClick={() => onToggle(date, habit.id)}
                        aria-pressed={done}
                        aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: ${habit.name}`}
                      >
                        <IconCheck size={15} />
                      </button>

                      {habit.type !== 'checkbox' ? (
                        <div className="task-input">
                          <HabitProgressInput
                            value={rec?.value ?? 0}
                            target={habit.target}
                            unit={habit.unit}
                            onCommit={(v) => onSetValue(date, habit.id, v)}
                            label={habit.name}
                          />
                        </div>
                      ) : !done ? (
                        <span className="task-meta task-hint">tap to complete</span>
                      ) : (
                        <span className="task-done-mark"><IconCheckCircle size={15} /></span>
                      )}
                    </>
                  ) : (
                    <span className="task-meta row task-lock" title={lockTitle}>
                      <IconLock size={13} /> {lockLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- RULES - what you CONTROLLED ---------- */}
      {elRules.length > 0 && (
        <section>
          <div className="section-label">
            <span className="section-label-rules">
              <IconShield size={13} /> Rules
              <span className="section-label-tag">what you control</span>
            </span>
            <span className="section-label-hint">
              {rulesFollowed}/{elRules.length} followed
            </span>
          </div>
          <div className="tasks-grid" style={{ gap: compact ? 8 : 10 }}>
            {elRules.map((rule) => {
              const stored = records[date]?.rules?.[rule.id];
              const followed = ruleFollowed(rule, stored);
              const broken = stored?.status === 'not_followed';
              return (
                <div
                  className={`task-item rule-item${followed ? ' done' : ''}${broken ? ' broken' : ''}`}
                  key={rule.id}
                >
                  <span className="task-icon rule-icon"><IconShield size={16} /></span>

                  <div className="task-body">
                    <div className="task-name truncate">{rule.text}</div>
                    <div className="task-meta truncate">
                      {editable
                        ? followed
                          ? 'Followed today'
                          : broken
                            ? 'Not followed today'
                            : 'Rule - kept accountable?'
                        : followed
                          ? 'Followed'
                          : broken
                            ? 'Not followed'
                            : 'Not marked'}
                    </div>
                    {editable && (
                      <div className="rule-status-row" role="group" aria-label={`Rule status: ${rule.text}`}>
                        <button
                          type="button"
                          className={`rule-status-btn followed${followed ? ' active' : ''}`}
                          onClick={() => onRuleStatus(date, rule.id, followed ? null : 'followed')}
                          aria-pressed={followed}
                        >
                          Followed
                        </button>
                        <button
                          type="button"
                          className={`rule-status-btn broken${broken ? ' active' : ''}`}
                          onClick={() =>
                            onRuleStatus(date, rule.id, broken ? null : 'not_followed')
                          }
                          aria-pressed={broken}
                        >
                          <IconX size={12} /> Not followed
                        </button>
                      </div>
                    )}
                  </div>

                  {editable ? (
                    <button
                      type="button"
                      className={`task-check${followed ? ' checked' : ''}`}
                      onClick={() => onRuleStatus(date, rule.id, followed ? null : 'followed')}
                      aria-pressed={followed}
                      aria-label={`${followed ? 'Unmark' : 'Mark'} followed: ${rule.text}`}
                    >
                      <IconCheck size={15} />
                    </button>
                  ) : (
                    <span className="task-meta row task-lock" title={lockTitle}>
                      <IconLock size={13} /> {lockLabel}
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