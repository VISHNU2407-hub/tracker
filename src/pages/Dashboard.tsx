import React, { useMemo, useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { useAnalytics } from '../hooks/useArc';
import type { PageId } from '../hooks/useArc';
import { DayTasks } from '../components/dashboard/DayTasks';
import { ArcHeatmap } from '../components/calendar/ArcHeatmap';
import { ProgressRing } from '../components/ui/ProgressRing';
import { DayDetail } from '../components/calendar/DayDetail';
import {
  IconFlame, IconTrophy, IconSpark, IconChart, IconNote, IconArrowLeft,
  IconCalendar, IconCheck, IconTarget,
} from '../components/icons';
import {
  formatDateRange, formatShort, todayISO, addDays, dayNumber, daysBetween, weekKeyOf,
} from '../services/date';
import { computeTrend, isArcComplete } from '../services/analytics';
import { habitCellFor } from '../components/habits/habitCell';
import { IconFor } from './Habits';

/* ============================================================
   Dashboard (spec §3): hero, quick stats, My Day, coming up,
   weekly summary, goal, habit glance, 90-day overview —
   every section is derived from real stored data only.
   ============================================================ */

export function DashboardPage({ api, onNavigate }: { api: AppDataApi; onNavigate: (p: PageId) => void }) {
  const { data } = api;
  const arc = data.arc!;
  const today = todayISO();
  const { stats, habitStats, evaluate } = useAnalytics(data);
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const todayEv = evaluate(today)!;
  const lastArcDay = addDays(arc.startDate, arc.durationDays - 1);
  const arcComplete = isArcComplete(arc, today);

  const finale = useMemo(() => {
    if (!arcComplete) return null;
    const days = stats?.elapsedDays ?? 0;
    let totalValue = 0;
    let loggedDays = 0;
    for (let i = 0; i < days; i++) {
      const d = addDays(arc.startDate, i);
      const rec = data.dailyRecords[d];
      if (rec && Object.keys(rec.habits).length > 0) loggedDays += 1;
      for (const h of data.habits) {
        const v = rec?.habits[h.id]?.value;
        if (typeof v === 'number') totalValue += v;
      }
    }
    const active = data.habits.filter((h) => h.active).length;
    return {
      perfectDays: stats?.perfectDays ?? 0,
      bestStreak: stats?.streaks.best ?? 0,
      currentStreak: stats?.streaks.current ?? 0,
      consistency: stats?.totalPct ?? null,
      totalValue,
      loggedDays,
      days,
      activeHabits: active,
      eligibleCount: todayEv.eligibleCount,
    };
  }, [arcComplete, stats, data.dailyRecords, data.habits, arc.startDate, todayEv.eligibleCount]);

  /* ---------- Derived summaries (real records only, no fake data) ---------- */

  // Last 14 arc days → "this week" (last 7) vs the previous 7 for comparison.
  const weekTrend = useMemo(
    () => computeTrend(arc, data.habits, data.dailyRecords, 14),
    [arc, data.habits, data.dailyRecords]
  );

  const week = useMemo(() => {
    const avg = (pts: typeof weekTrend): number | null => {
      const tracked = pts.filter((p) => p.pct !== null);
      if (tracked.length === 0) return null;
      return Math.round(tracked.reduce((s, p) => s + (p.pct ?? 0), 0) / tracked.length);
    };
    const last7 = weekTrend.slice(-7);
    const prev7 = weekTrend.slice(0, -7);
    const tracked = last7.filter((p) => p.pct !== null);
    return {
      last7,
      avg: avg(last7),
      prevAvg: avg(prev7),
      perfect: tracked.filter((p) => p.pct === 100).length,
      partialDays: tracked.filter((p) => (p.pct ?? 0) > 0 && (p.pct ?? 0) < 100).length,
      missed: tracked.filter((p) => p.pct === 0).length,
      tracked: tracked.length,
    };
  }, [weekTrend]);

  const weekDelta = week.avg !== null && week.prevAvg !== null ? week.avg - week.prevAvg : null;

  // This week's reflection status (stored by ISO week key).
  const reflectionSaved = Boolean(data.reflections[weekKeyOf(today)]);

  // Arc countdown + next milestone (day-number milestones of the Arc).
  const dayNum = stats?.dayNumber ?? 1;
  const daysLeft = Math.max(0, arc.durationDays - dayNum);
  const milestoneStep = arc.durationDays >= 90 ? 30 : Math.max(1, Math.round(arc.durationDays / 3));
  const milestoneList: number[] = [];
  for (let m = milestoneStep; m < arc.durationDays; m += milestoneStep) milestoneList.push(m);
  milestoneList.push(arc.durationDays);
  const nextMilestone = milestoneList.find((m) => m > dayNum) ?? null;
  const nextMilestoneDate = nextMilestone ? addDays(arc.startDate, nextMilestone - 1) : null;
  const nextMilestoneIn = nextMilestoneDate ? daysBetween(today, nextMilestoneDate) : null;

  const tomorrow = addDays(today, 1);
  const tomorrowLabel =
    tomorrow < arc.startDate
      ? `Arc starts ${formatShort(arc.startDate)}`
      : arcComplete || tomorrow > lastArcDay
        ? `Arc ends ${formatShort(lastArcDay)}`
        : `Day ${Math.min(dayNum + 1, arc.durationDays)} · ${formatShort(tomorrow)}`;

  // Streak guard — what today means for the current perfect-day streak.
  const guard: { good: boolean; text: string } | null = arcComplete
    ? null
    : todayEv.pct === null
      ? { good: false, text: 'No habits are eligible today — add or restore a habit to keep tracking.' }
      : todayEv.isPerfect
        ? {
            good: true,
            text: (stats?.streaks.current ?? 0) > 0
              ? `Perfect day — your ${stats!.streaks.current}-day streak is safe.`
              : 'Perfect day — that\'s how a streak starts.',
          }
        : (() => {
            const remaining = todayEv.eligibleCount - todayEv.completedCount;
            const streak = stats?.streaks.current ?? 0;
            return {
              good: false,
              text: streak > 0
                ? `${remaining} habit${remaining === 1 ? '' : 's'} left today to keep your ${streak}-day streak alive.`
                : `${remaining} habit${remaining === 1 ? '' : 's'} left today — finish them all to start a streak.`,
            };
          })();

  // Habits at a glance — active habits only, ordered like the Habits page.
  const glance = habitStats
    .filter((s) => s.habit.active)
    .sort((a, b) => a.habit.order - b.habit.order);

  return (
    <div className="stack" style={{ gap: 20 }}>
      {/* Hero */}
      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-kicker">{arc.title}</div>
            <h1 className="hero-title">WINTER ARC</h1>
            <p className="hero-dates">
              {formatDateRange(arc.startDate, lastArcDay)} · {arc.durationDays} days
            </p>
          </div>
          <div className="hero-progress-wrap">
            <div style={{ textAlign: 'right' }}>
              <div className="hero-day-num">
                Day {stats?.dayNumber ?? 1}
                <span className="hero-day-of"> / {arc.durationDays}</span>
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {formatShort(today)}
              </div>
              {arcComplete && <div className="success-text small" style={{ marginTop: 4 }}>✓ Arc complete</div>}
            </div>
          </div>
        </div>

        {/* Arc progress bar */}
        <div className="hero-bar" role="progressbar" aria-valuenow={stats?.dayNumber ?? 1} aria-valuemin={1} aria-valuemax={arc.durationDays} aria-label="Arc progress">
          <div
            className="hero-bar-fill"
            style={{ width: `${(((stats?.dayNumber ?? 1) / arc.durationDays) * 100).toFixed(1)}%` }}
          />
        </div>

        {arc.goal && <p className="hero-goal">🎯 {arc.goal}</p>}
      </section>

      {/* Arc finale — shown once every Arc day has passed */}
      {arcComplete && finale && (
        <section className="card" style={{ borderColor: 'var(--success-border)', background: 'var(--success-dim)' }} role="status">
          <div className="card-title">
            <span>Your {arc.durationDays}-day Arc is complete</span>
            <IconTrophy size={16} style={{ color: 'var(--success)' }} />
          </div>
          <p className="secondary small" style={{ marginBottom: 14 }}>
            {finale.eligibleCount === 0
              ? 'No habits were eligible during this Arc.'
              : `${finale.days} days · ${finale.loggedDays} with logged progress · ${finale.activeHabits} active habit${finale.activeHabits === 1 ? '' : 's'}.`}
          </p>
          <div className="stats-row">
            <StatCard icon={<IconSpark size={16} />} green value={finale.perfectDays} label="Perfect days" />
            <StatCard icon={<IconTrophy size={16} />} green value={finale.bestStreak} label="Best streak" sub="days" />
            <StatCard
              icon={<IconChart size={16} />}
              value={finale.consistency === null ? '—' : `${finale.consistency}%`}
              label="Consistency"
              sub="avg daily"
            />
            <StatCard icon={<IconFlame size={16} />} value={finale.totalValue} label="Total logged" sub="all units" />
          </div>
        </section>
      )}

      {/* Quick stats */}
      <section className="stats-row" aria-label="Quick stats">
        <StatCard icon={<IconFlame size={16} />} value={stats?.streaks.current ?? 0} label="Current streak" sub="days" />
        <StatCard icon={<IconTrophy size={16} />} green value={stats?.streaks.best ?? 0} label="Best streak" sub="days" />
        <StatCard icon={<IconSpark size={16} />} green value={stats?.perfectDays ?? 0} label="Perfect days" />
        <StatCard
          icon={<IconChart size={16} />}
          value={stats?.totalPct === null || stats?.totalPct === undefined ? '—' : `${stats.totalPct}%`}
          label="Consistency"
          sub="avg daily"
        />
      </section>

      {/* Today's tasks + progress ring */}
      <section className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <span>My Day — today's tasks</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('today')}>
              Open day view <IconArrowLeft size={13} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>
          <DayTasks
            arc={arc}
            habits={data.habits}
            records={data.dailyRecords}
            date={today}
            now={today}
            onToggle={api.toggleHabit}
            onSetValue={api.setHabitValue}
          />
        </div>

        <div className="stack">
          <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 26 }}>
            <ProgressRing pct={todayEv.pct} size={140} stroke={11} label="Today" />
            <p className="small muted" style={{ marginTop: 12, textAlign: 'center' }}>
              {todayEv.pct === null
                ? 'No habits yet — add your first habit.'
                : todayEv.isPerfect
                  ? `Perfect day — all ${todayEv.eligibleCount} habits complete.`
                  : `${todayEv.completedCount} of ${todayEv.eligibleCount} done · ${todayEv.eligibleCount - todayEv.completedCount} to go`}
            </p>
          </div>

          {data.dailyRecords[today]?.note && (
            <div className="card">
              <div className="card-title"><span>Today's note</span><IconNote size={14} /></div>
              <p className="secondary" style={{ whiteSpace: 'pre-wrap' }}>{data.dailyRecords[today].note}</p>
            </div>
          )}
        </div>
      </section>

      {/* Coming up + weekly summary */}
      <section className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <span>Coming up</span>
            <IconCalendar size={14} />
          </div>

          {guard && (
            <div className={`coming-note${guard.good ? ' good' : ''}`} role="status">
              <IconFlame
                size={15}
                style={{ color: guard.good ? 'var(--success)' : 'var(--warning)', flexShrink: 0, marginTop: 1 }}
              />
              <span>{guard.text}</span>
            </div>
          )}

          <div className="kv-row">
            <span className="kv-key">Arc progress</span>
            <span className="kv-val">
              {arcComplete
                ? `${arc.durationDays} days · finished`
                : `Day ${dayNum} of ${arc.durationDays} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
            </span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Arc ends</span>
            <span className="kv-val">{formatShort(lastArcDay)}</span>
          </div>
          {!arcComplete && (
            <div className="kv-row">
              <span className="kv-key">Next milestone</span>
              <span className="kv-val">
                {nextMilestone === null
                  ? 'Final day — today'
                  : `Day ${nextMilestone} · ${nextMilestoneIn === 0 ? 'today' : `in ${nextMilestoneIn} day${nextMilestoneIn === 1 ? '' : 's'}`}`}
              </span>
            </div>
          )}
          <div className="kv-row">
            <span className="kv-key">Tomorrow</span>
            <span className="kv-val">{tomorrowLabel}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">This week's reflection</span>
            <span className="kv-val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              {reflectionSaved ? (
                <span className="success-text row" style={{ gap: 5 }}><IconCheck size={14} /> Written</span>
              ) : (
                <>
                  <span className="muted">Not written yet</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('reflection')}>
                    Write
                  </button>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <span>This week</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('stats')}>
              Full stats <IconArrowLeft size={13} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span className="stat-value" style={{ fontSize: 30 }}>
              {week.avg === null ? '—' : `${week.avg}%`}
            </span>
            <span className="small muted">average · last 7 days</span>
            {weekDelta !== null && (
              <span className={`delta${weekDelta > 0 ? ' up' : weekDelta < 0 ? ' down' : ''}`}>
                {weekDelta > 0 ? '▲' : weekDelta < 0 ? '▼' : '•'}{' '}
                {weekDelta === 0 ? 'no change' : `${Math.abs(weekDelta)} pts`} vs previous 7 days
              </span>
            )}
          </div>

          <p className="small secondary" style={{ marginTop: 10 }}>
            {week.tracked === 0
              ? 'No tracked days yet — log habits to build your weekly picture.'
              : `${week.perfect} perfect · ${week.partialDays} partial · ${week.missed} missed of ${week.tracked} tracked day${week.tracked === 1 ? '' : 's'}.`}
          </p>

          <div
            className="trend-chart"
            style={{ height: 72, marginTop: 12 }}
            role="img"
            aria-label={`Daily completion for the last ${week.last7.length} days. ${week.tracked === 0 ? 'No tracked days.' : `${week.perfect} perfect, ${week.partialDays} partial, ${week.missed} missed.`}`}
          >
            {week.last7.map((p) => (
              <div
                key={p.date}
                className={`trend-bar${p.pct === null ? ' none' : ''}`}
                style={{ height: `${p.pct === null ? 3 : Math.max(3, p.pct)}%` }}
                title={`${formatShort(p.date)}: ${p.pct === null ? 'no habits' : `${p.pct}%`}`}
              />
            ))}
          </div>
          <div className="trend-axis">
            <span>{week.last7.length ? formatShort(week.last7[0].date) : ''}</span>
            <span>{week.last7.length ? formatShort(week.last7[week.last7.length - 1].date) : ''}</span>
          </div>
        </div>
      </section>

      {/* Arc goal & rules — straight from My Winter Arc */}
      <section className="card">
        <div className="card-title">
          <span className="row" style={{ gap: 6 }}><IconTarget size={14} /> Your goal</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('myarc')}>
            Edit in My Winter Arc
          </button>
        </div>
        <div className="goal-layout">
          <div>
            <p className="goal-text">{arc.goal || 'No goal set yet.'}</p>
            {!arc.goal && (
              <p className="small muted" style={{ marginTop: 6 }}>
                Add a goal so every day of the Arc has a direction.
              </p>
            )}
            {arc.why && (
              <p className="secondary small" style={{ marginTop: 8 }}>
                <strong className="muted">Why:</strong> {arc.why}
              </p>
            )}
          </div>
          <div className="goal-rules">
            <span className="hs-k">Rules ({arc.rules.length})</span>
            {arc.rules.length === 0 ? (
              <p className="small muted" style={{ marginTop: 6 }}>No personal rules yet.</p>
            ) : (
              <ul>
                {arc.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Habits at a glance — compact per-habit performance */}
      <section className="card">
        <div className="card-title">
          <span>Habits at a glance</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('habits')}>
            Manage habits <IconArrowLeft size={13} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
        {glance.length === 0 ? (
          <div className="empty-state">
            <div className="big">No active habits</div>
            <p>Add your first habit to start tracking your days.</p>
          </div>
        ) : (
          <div>
            {glance.map((s) => {
              const Icon = IconFor(s.habit.icon);
              const cellState = habitCellFor(s.habit, today, data.dailyRecords, today, arc).state;
              const todayText =
                cellState === 'done' ? 'Done today'
                : cellState === 'pending' || cellState === 'partial' ? 'In progress today'
                : cellState === 'missed' ? 'Missed today'
                : cellState === 'outside' ? (today > lastArcDay ? 'Arc finished' : 'Arc not started yet')
                : 'Not active today';
              return (
                <div className="habit-stat-row" key={s.habit.id}>
                  <div className="row" style={{ minWidth: 0 }}>
                    <span className="task-icon" style={{ width: 28, height: 28 }}><Icon size={13} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="task-name truncate">{s.habit.name}</div>
                      <div className="task-meta">
                        <span className={cellState === 'done' ? 'success-text' : ''}>{todayText}</span>
                        {' · '}{s.completedCount}/{s.eligibleCount} eligible days
                      </div>
                    </div>
                  </div>
                  <div className="stat-value" style={{ fontSize: 16 }}>{s.rate === null ? '—' : `${s.rate}%`}</div>
                  <div className="hs-bar">
                    <div className="rate-bar">
                      <div
                        className={`rate-bar-fill${s.rate !== null && s.rate >= 80 ? ' good' : ''}`}
                        style={{ width: `${s.rate ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="hs-streak small secondary">
                    <IconFlame size={12} style={{ verticalAlign: '-2px' }} /> {s.currentStreak} / {s.bestStreak}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 90-day overview */}
      <section className="card">
        <div className="card-title">
          <span>90-day overview</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('calendar')}>
            Full calendar
          </button>
        </div>
        <ArcHeatmap
          arc={arc}
          habits={data.habits}
          records={data.dailyRecords}
          onDayClick={setDetailDate}
          cellSize={11}
          showLegend={false}
        />
      </section>

      {detailDate && (
        <DayDetail date={detailDate} api={api} onClose={() => setDetailDate(null)} />
      )}
    </div>
  );
}

function StatCard({
  icon, value, label, sub, green,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  sub?: string;
  green?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon${green ? ' green' : ''}`}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}{sub ? ` · ${sub}` : ''}</div>
    </div>
  );
}
