import React, { useState } from 'react';
import type { Habit } from '../types';
import { useAppData, type AppDataApi } from '../hooks/useAppData';
import { useAnalytics } from '../hooks/useArc';
import { PageHeader } from '../components/layout/PageHeader';
import { HabitForm, type HabitFormValues } from '../components/habits/HabitForm';
import { HabitInsights } from '../components/habits/HabitInsights';
import { DayDetail } from '../components/calendar/DayDetail';
import { ConfirmModal } from '../components/ui/Modal';
import { ProgressRing } from '../components/ui/ProgressRing';
import { todayISO } from '../services/date';
import {
  IconPlus, IconEdit, IconArchive, IconTrash, IconRestore, IconUp, IconDown, IconDumbbell,
  IconClock, IconHash, IconCheck, IconTarget, IconFlame, IconSpark, IconNote, IconBook,
} from '../components/icons';

/* ============================================================
   Habits page (spec §3): add / edit / archive / reorder.
   Archived habits preserve history. Each habit card also shows
   richer performance insights (streaks, rate, recent activity)
   derived from existing analytics — nothing new is stored.
   ============================================================ */

const ICON_MAP: Record<string, React.FC<{ size?: number }>> = {
  dumbbell: IconDumbbell,
  book: IconBook,
  clock: IconClock,
  hash: IconHash,
  check: IconCheck,
  target: IconTarget,
  flame: IconFlame,
  spark: IconSpark,
  note: IconNote,
};

export function IconFor(key: string) {
  return ICON_MAP[key] ?? IconTarget;
}

export function HabitsPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const { habitStats } = useAnalytics(data);
  const arc = data.arc!;
  const today = todayISO();
  const statMap = new Map(habitStats.map((s) => [s.habit.id, s]));

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Habit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Habit | null>(null);
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const active = data.habits.filter((h) => h.active).sort((a, b) => a.order - b.order);
  const archived = data.habits.filter((h) => !h.active).sort((a, b) => a.order - b.order);

  const saveForm = (values: HabitFormValues) => {
    if (editing) {
      api.updateHabit(editing.id, values);
    } else {
      api.addHabit(values);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const move = (habit: Habit, dir: -1 | 1) => {
    const ids = active.map((h) => h.id);
    const i = ids.indexOf(habit.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    api.reorderHabits(ids);
  };

  const rateFor = (habit: Habit) => habitStats.find((s) => s.habit.id === habit.id)?.rate ?? null;

  return (
    <div>
      <PageHeader
        title="Habits"
        sub="Your reusable habit definitions. Editing never rewrites history."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <IconPlus size={15} /> Add habit
          </button>
        }
      />

      {/* Active habits */}
      <div className="stack">
        {active.length === 0 && (
          <div className="card empty-state">
            <div className="big">No active habits</div>
            <p>Add at least one habit to start tracking your days.</p>
          </div>
        )}
        {active.map((habit, idx) => {
          const rate = rateFor(habit);
          const Icon = IconFor(habit.icon);
          const stat = statMap.get(habit.id);
          return (
            <div className="habit-card" key={habit.id}>
              <div className="habit-card-top">
                <span className="task-icon"><Icon size={16} /></span>
                <div className="task-body">
                  <div className="task-name truncate">{habit.name}</div>
                  <div className="task-meta">
                    {habit.type === 'checkbox' ? 'Checkbox · done when checked'
                      : habit.type === 'duration' ? `Duration · ${habit.target} min/day`
                      : `Numeric · ${habit.target} ${habit.unit || ''}/day`}
                  </div>
                </div>
                {rate !== null && <span className="habit-rate" title="Completion rate over eligible days">{rate}%</span>}
                <div className="habit-actions">
                  <button type="button" className="btn btn-ghost btn-icon" disabled={idx === 0} onClick={() => move(habit, -1)} aria-label={`Move ${habit.name} up`}>
                    <IconUp size={15} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon" disabled={idx === active.length - 1} onClick={() => move(habit, 1)} aria-label={`Move ${habit.name} down`}>
                    <IconDown size={15} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => { setEditing(habit); setFormOpen(true); }} aria-label={`Edit ${habit.name}`}>
                    <IconEdit size={15} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setConfirmArchive(habit)} aria-label={`Archive ${habit.name}`}>
                    <IconArchive size={15} />
                  </button>
                </div>
              </div>

              {stat && (
                <HabitInsights
                  habit={habit}
                  stat={stat}
                  arc={arc}
                  records={data.dailyRecords}
                  now={today}
                  onDayClick={setDetailDate}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Archived habits */}
      {archived.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="card-title">Archived — history preserved</div>
          <div className="stack">
            {archived.map((habit) => {
              const Icon = IconFor(habit.icon);
              const rate = rateFor(habit);
              const stat = statMap.get(habit.id);
              return (
                <div className="habit-card archived" key={habit.id}>
                  <div className="habit-card-top">
                    <span className="task-icon"><Icon size={16} /></span>
                    <div className="task-body">
                      <div className="row" style={{ gap: 8, minWidth: 0 }}>
                        <div className="task-name truncate">{habit.name}</div>
                        <span className="hc-chip paused">Paused</span>
                      </div>
                      <div className="task-meta">Archived · still counted in past days &amp; analytics</div>
                    </div>
                    {rate !== null && <span className="habit-rate">{rate}%</span>}
                    <div className="habit-actions">
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => api.restoreHabit(habit.id)} aria-label={`Restore ${habit.name}`}>
                        <IconRestore size={15} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setConfirmDelete(habit)} aria-label={`Delete ${habit.name} permanently`}>
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>

                  {stat && (
                    <HabitInsights
                      habit={habit}
                      stat={stat}
                      arc={arc}
                      records={data.dailyRecords}
                      now={today}
                      defaultOpen={false}
                      onDayClick={setDetailDate}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {formOpen && (
        <HabitForm initial={editing} onSave={saveForm} onCancel={() => { setFormOpen(false); setEditing(null); }} />
      )}

      {confirmArchive && (
        <ConfirmModal
          title="Archive habit?"
          message={
            <>
              <strong>{confirmArchive.name}</strong> will be removed from today's list but{' '}
              <strong>all past records and analytics stay intact</strong>. You can restore it any time.
            </>
          }
          confirmLabel="Archive"
          onConfirm={() => api.archiveHabit(confirmArchive.id)}
          onClose={() => setConfirmArchive(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete permanently?"
          danger
          requireText="DELETE"
          message={
            <>
              This removes <strong>{confirmDelete.name}</strong> and its recorded values from every day.
              If you only want it off today's list, archive it instead — archiving keeps history.
            </>
          }
          confirmLabel="Delete forever"
          onConfirm={() => api.deleteHabitPermanently(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {detailDate && <DayDetail date={detailDate} api={api} onClose={() => setDetailDate(null)} />}
    </div>
  );
}
