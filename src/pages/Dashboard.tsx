import React, { useMemo, useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { useAnalytics, trackScope } from '../hooks/useArc';
import type { PageId } from '../hooks/useArc';
import { DayTasks } from '../components/dashboard/DayTasks';
import { ArcHeatmap } from '../components/calendar/ArcHeatmap';
import { ProgressRing } from '../components/ui/ProgressRing';
import { LineChart } from '../components/ui/Charts';
import { DayDetail } from '../components/calendar/DayDetail';
import {
  IconFlame, IconTrophy, IconSpark, IconChart, IconNote, IconArrowLeft,
  IconCalendar, IconCheck, IconTarget, IconShield, IconSettings,
  IconCheckCircle, IconPlus,
} from '../components/icons';
import {
  formatDateRange, formatShort, todayISO, addDays, daysBetween, weekKeyOf,
} from '../services/date';
import { computeTrend, isArcComplete } from '../services/analytics';
import { habitCellFor } from '../components/habits/habitCell';
import { IconFor } from './Habits';

/* ============================================================
   Dashboard: greeting header, active-track progress hero, quick
   stats (incl. Rule Control), Today's habits & rules, coming up,
   weekly summary, goal, habit & rule glance, track overview.
   Every value is derived from real stored data only.
   ============================================================ */

/* Rotating daily motivation - deterministic per track day, purely
   presentational (nothing stored). */
const MOTIVATION = [
  'Show up today - consistency rewards the patient.',
  'One day at a time. They compound.',
  'Discipline beats motivation.',
  'Small daily wins beat rare heroic days.',
  'The streak is built right now.',
  'Future you is watching - make them proud.',
  'Progress loves quiet, repeated effort.',
  'Perfect days are built one habit at a time.',
  'Consistency is the shortcut.',
  'The Life System continues - today is one step.',
];

function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage({ api, onNavigate }: { api: AppDataApi; onNavigate: (p: PageId) => void }) {
  const { data } = api;
  const arc = data.arc!;
  const today = todayISO();
  const { stats, habitStats, ruleStats, evaluate } = useAnalytics(data);
  const { habits: scopedHabits, rules: scopedRules } = trackScope(data);
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
      for (const h of scopedHabits) {
        const v = rec?.habits[h.id]?.value;
        if (typeof v === 'number') totalValue += v;
      }
    }
    const active = scopedHabits.filter((h) => h.active).length;
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
  }, [arcComplete, stats, data.dailyRecords, scopedHabits, arc.startDate, todayEv.eligibleCount]);

  /* ---------- Derived summaries (real records only, no fake data) ---------- */

  // Last 14 arc days = "this week" (last 7) vs the previous 7 for comparison.
  const weekTrend = useMemo(
    () => computeTrend(arc, scopedHabits, scopedRules, data.dailyRecords, 14),
    [arc, scopedHabits, scopedRules, data.dailyRecords]
  );

  const week = useMemo(() => {
    const avg = (pts: typeof weekTrend): number | null => {
      const tracked = pts.filter((p) => p.pct !== null);
      if (tracked.length === 0) return null;
      return Math.round(tracked.reduce((s, p) => s + (p.pct ?? 0), 0) / tracked.length);
    };
    // 7-day rolling average at each point - context line for the daily trend.
    const withAvg = weekTrend.map((p, i) => {
      const win = weekTrend.slice(Math.max(0, i - 6), i + 1).filter((q) => q.pct !== null);
      return {
        ...p,
        sub: win.length === 0 ? null : Math.round(win.reduce((s, q) => s + (q.pct ?? 0), 0) / win.length),
      };
    });
    const last7 = weekTrend.slice(-7);
    const prev7 = weekTrend.slice(0, -7);
    const tracked = last7.filter((p) => p.pct !== null);
    return {
      last7,
      trend14: withAvg,
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
  // Before the Arc begins, "Day 1" is a clamp artifact - count down to the
  // start instead of pretending the whole Arc is still ahead.
  const daysUntilStart = Math.max(0, daysBetween(today, arc.startDate));
  const notStarted = daysUntilStart > 0 && !arcComplete;
  const daysLeft = notStarted ? daysUntilStart : Math.max(0, arc.durationDays - dayNum);
  const arcPct = notStarted ? 0 : Math.min(100, Math.round((dayNum / arc.durationDays) * 100));
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
      ? `Track starts ${formatShort(arc.startDate)}`
      : arcComplete || tomorrow > lastArcDay
        ? `Track ends ${formatShort(lastArcDay)}`
        : `Day ${Math.min(dayNum + 1, arc.durationDays)} - ${formatShort(tomorrow)}`;

  // Streak guard - what today means for the current perfect-day streak.
  const guard: { good: boolean; text: string } | null = arcComplete
    ? null
    : todayEv.pct === null
      ? { good: false, text: 'No habits or rules are eligible today - add one to keep tracking.' }
      : todayEv.isPerfect
        ? {
            good: true,
            text: (stats?.streaks.current ?? 0) > 0
              ? `Perfect day - your ${stats!.streaks.current}-day streak is safe.`
              : 'Perfect day - that is how a streak starts.',
          }
        : (() => {
            const remaining = todayEv.eligibleCount - todayEv.completedCount;
            const streak = stats?.streaks.current ?? 0;
            return {
              good: false,
              text: streak > 0
                ? `${remaining} item${remaining === 1 ? '' : 's'} left today to keep your ${streak}-day streak alive.`
                : `${remaining} item${remaining === 1 ? '' : 's'} left today - finish them all to start a streak.`,
            };
          })();

  // Habits & rules at a glance - active only, ordered like their pages.
  const glance = habitStats
    .filter((s) => s.habit.active)
    .sort((a, b) => a.habit.order - b.habit.order);
  const rulesGlance = ruleStats
    .filter((s) => s.rule.active)
    .sort((a, b) => a.rule.order - b.rule.order);

  // Aggregate rule control across all rules (used by the Rule Control stat card).
  const ruleAgg = useMemo(() => {
    const followed = ruleStats.reduce((s, r) => s + r.followedCount, 0);
    const eligible = ruleStats.reduce((s, r) => s + r.eligibleCount, 0);
    return { followed, eligible, pct: eligible === 0 ? null : Math.round((followed / eligible) * 100) };
  }, [ruleStats]);

  return (
    <div className="stack" style={{ gap: 12 }}>
      {/* ---------- Greeting header ---------- */}
      <section className="dash-header">
        <div className="dash-greet-text">
          <div className="dash-hello">
            {greetingFor(new Date().getHours())}
            <span className="dash-hello-dot" aria-hidden="true" />
            {arcComplete
              ? 'Track complete'
              : notStarted
                ? `Starts in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                : `${daysLeft} day${daysLeft === 1 ? '' : 's'} to go`}
          </div>
          <h1 className="dash-title">Day {dayNum} of {arc.title}</h1>
          <p className="dash-motiv">{MOTIVATION[(dayNum - 1) % MOTIVATION.length]}</p>
        </div>

        <div className="dash-actions">
          <button type="button" className="btn btn-icon" onClick={() => onNavigate('settings')} aria-label="Settings">
            <IconSettings size={17} />
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate('today')}>
            <IconPlus size={15} /> Log today
          </button>
        </div>
      </section>

      {/* ---------- Active track progress: the hero moment ---------- */}
      <section className="hero">
        <div className="hero-top">
          <div className="hero-copy">
            <div className="hero-kicker">Active track</div>
            <div className="hero-title">{arc.title}</div>
            <p className="hero-dates">
              {formatDateRange(arc.startDate, lastArcDay)} · {arc.durationDays} days
            </p>
            {arc.goal && <p className="hero-goal">{arc.goal}</p>}
          </div>

          <div className="hero-progress-wrap">
            <div className="hero-ring">
              <ProgressRing
                pct={arcPct}
                size={110}
                stroke={9}
                label="Track progress"
                caption={`of ${arc.durationDays} days`}
              />
            </div>
            <div className="hero-dayblock">
              <div className="hero-day-num">
                {dayNum}
                <span className="hero-day-of"> / {arc.durationDays}</span>
              </div>
              <div className="hero-days-label">
                {arcComplete
                  ? 'Track finished'
                  : notStarted
                    ? `Starts ${formatShort(arc.startDate)}`
                    : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
              </div>
              <div className="hero-days-date">{formatShort(today)}</div>
            </div>
          </div>
        </div>

        {/* Progress bar + milestone context */}
        <div
          className="hero-bar"
          role="progressbar"
          aria-valuenow={dayNum}
          aria-valuemin={1}
          aria-valuemax={arc.durationDays}
          aria-label="Track progress"
        >
          <div className="hero-bar-fill" style={{ width: `${arcPct}%` }} />
        </div>

        <div className="hero-bar-meta">
          <span><strong>{arcPct}%</strong> of the way through your track</span>
          <span>
            {nextMilestone === null
              ? 'Final day - today'
              : `Next milestone: Day ${nextMilestone}${
                  nextMilestoneIn === 0 ? ' (today)' : ` in ${nextMilestoneIn} day${nextMilestoneIn === 1 ? '' : 's'}`
                }`}
          </span>
          <span>Track ends <strong>{formatShort(lastArcDay)}</strong></span>
        </div>

        {/* Streak snapshot - warm orange for streaks, mint for records */}
        <div className="hero-streaks">
          <span className="hero-chip streak">
            <IconFlame size={14} /> {stats?.streaks.current ?? 0}-day streak
          </span>
          <span className="hero-chip best">
            <IconTrophy size={14} /> Best {stats?.streaks.best ?? 0}
          </span>
          <span className="hero-chip perfect">
            <IconSpark size={14} /> {stats?.perfectDays ?? 0} perfect days
          </span>
          <span className="hero-chip ring-note">
            {todayEv.pct === null
              ? 'Nothing eligible yet - add a habit or rule.'
              : todayEv.isPerfect
                ? `Perfect day - all ${todayEv.eligibleCount} items complete.`
                : `${todayEv.completedCount} of ${todayEv.eligibleCount} done today · ${
                    todayEv.eligibleCount - todayEv.completedCount
                  } to go`}
          </span>
        </div>
      </section>

      {/* Track finale - shown once every track day has passed */}
      {arcComplete && finale && (
        <section className="card card-finale" role="status">
          <div className="card-title">
            <span>{arc.title} — complete</span>
            <IconTrophy size={16} style={{ color: 'var(--success)' }} />
          </div>
          <p className="secondary small" style={{ marginBottom: 14 }}>
            {finale.eligibleCount === 0
              ? 'No habits or rules were eligible during this track.'
              : `${finale.days} days · ${finale.loggedDays} with logged progress · ${finale.activeHabits} active habit${finale.activeHabits === 1 ? '' : 's'}.`}
          </p>
          <div className="stats-row">
            <StatCard tone="mint" icon={<IconSpark size={16} />} value={finale.perfectDays} label="Perfect days" />
            <StatCard tone="mint" icon={<IconTrophy size={16} />} value={finale.bestStreak} label="Best streak" sub="days" />
            <StatCard
              icon={<IconChart size={16} />}
              value={finale.consistency === null ? '-' : `${finale.consistency}%`}
              label="Consistency"
              sub="avg daily"
            />
            <StatCard icon={<IconShield size={16} />} value={ruleAgg.pct === null ? '-' : `${ruleAgg.pct}%`} label="Rule control" sub="days followed" />
          </div>
        </section>
      )}

      {/* ---------- Quick stats ---------- */}
      <section className="stats-row" aria-label="Quick stats">
        <StatCard tone="orange" icon={<IconFlame size={16} />} value={stats?.streaks.current ?? 0} label="Current streak" sub="days" />
        <StatCard tone="mint" icon={<IconTrophy size={16} />} value={stats?.streaks.best ?? 0} label="Best streak" sub="days" />
        <StatCard tone="blue" icon={<IconCheckCircle size={16} />} value={`${todayEv.habitDone}/${todayEv.habitEligible}`} label="Today's habits" sub="done so far" />
        <StatCard
          tone="violet"
          icon={<IconChart size={16} />}
          value={stats?.totalPct == null ? '-' : `${stats.totalPct}%`}
          label="Overall completion"
          sub="all track days"
        />
        <StatCard
          tone="pink"
          icon={<IconShield size={16} />}
          value={ruleAgg.pct === null ? '-' : `${ruleAgg.pct}%`}
          label="Rule control"
          sub={`${ruleAgg.followed}/${ruleAgg.eligible} followed`}
        />
      </section>

      {/* ---------- Today: the important horizontal section ---------- */}
      <section className="card card-today">
        <div className="card-title">
          <span className="card-title-main">
            <IconCheckCircle size={14} /> My Day
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('today')}>
            Open day view <IconArrowLeft size={13} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
        <DayTasks
          arc={arc}
          habits={scopedHabits}
          rules={scopedRules}
          records={data.dailyRecords}
          date={today}
          now={today}
          onToggle={api.toggleHabit}
          onSetValue={api.setHabitValue}
          onRuleStatus={api.setRuleStatus}
        />
      </section>

      {data.dailyRecords[today]?.note && (
        <div className="card">
          <div className="card-title"><span>Today's note</span><IconNote size={14} /></div>
          <p className="secondary" style={{ whiteSpace: 'pre-wrap' }}>{data.dailyRecords[today].note}</p>
        </div>
      )}

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
                style={{ color: guard.good ? 'var(--success-strong)' : 'var(--warning-strong)', flexShrink: 0, marginTop: 1 }}
              />
              <span>{guard.text}</span>
            </div>
          )}

          <div className="kv-row">
            <span className="kv-key">Track progress</span>
            <span className="kv-val">
              {arcComplete
                ? `${arc.durationDays} days · finished`
                : `Day ${dayNum} of ${arc.durationDays} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
            </span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Track ends</span>
            <span className="kv-val">{formatShort(lastArcDay)}</span>
          </div>
          {!arcComplete && (
            <div className="kv-row">
              <span className="kv-key">Next milestone</span>
              <span className="kv-val">
                {nextMilestone === null
                  ? 'Final day - today'
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
              {week.avg === null ? '-' : `${week.avg}%`}
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
              ? 'No tracked days yet - log habits and rules to build your weekly picture.'
              : `${week.perfect} perfect · ${week.partialDays} partial · ${week.missed} missed of ${week.tracked} tracked day${week.tracked === 1 ? '' : 's'}.`}
          </p>

          <div style={{ marginTop: 12 }}>
            <LineChart
              points={week.trend14.map((p) => ({ label: p.date, value: p.pct, sub: p.sub }))}
              height={148}
              ariaLabel={`Daily completion for the last ${week.trend14.length} days. ${week.tracked === 0 ? 'No tracked days.' : `${week.perfect} perfect, ${week.partialDays} partial, ${week.missed} missed.`}`}
            />
            {week.trend14.some((p) => p.sub !== null) && (
              <div className="row small muted" style={{ gap: 6, marginTop: 6 }}>
                <span style={{ width: 16, height: 0, borderTop: '2px dashed var(--chart-avg)', display: 'inline-block' }} />
                7-day rolling average · solid line = daily completion
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Track goal & rules - straight from My Tracks */}
      <section className="card">
        <div className="card-title">
          <span className="card-title-main"><IconTarget size={14} /> Your goal</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('tracks')}>
            Edit in My Tracks
          </button>
        </div>
        <div className="goal-layout">
          <div>
            <p className="goal-text">{arc.goal || 'No goal set yet.'}</p>
            {!arc.goal && (
              <p className="small muted" style={{ marginTop: 6 }}>
                Add a goal so every day of the track has a direction.
              </p>
            )}
            {arc.why && (
              <p className="secondary small" style={{ marginTop: 8 }}>
                <strong className="muted">Why:</strong> {arc.why}
              </p>
            )}
          </div>
          <div className="goal-rules">
            <span className="hs-k">Rules ({rulesGlance.length} active)</span>
            {rulesGlance.length === 0 ? (
              <p className="small muted" style={{ marginTop: 6 }}>No active rules yet.</p>
            ) : (
              <ul>
                {rulesGlance.map((r) => (
                  <li key={r.rule.id}>
                    {r.rule.text}
                    <span className="small muted" style={{ marginLeft: 6 }}>
                      {r.rate === null ? '' : `· ${r.rate}% followed`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Habits at a glance - compact per-habit performance */}
      <section className="card">
        <div className="card-title">
          <span className="card-title-main"><IconCheck size={14} /> Habits at a glance</span>
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
                : cellState === 'outside' ? (today > lastArcDay ? 'Track finished' : 'Track not started yet')
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
                  <div className="stat-value" style={{ fontSize: 16 }}>{s.rate === null ? '-' : `${s.rate}%`}</div>
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

      {/* Rules at a glance - self-control performance, kept visually distinct */}
      {rulesGlance.length > 0 && (
        <section className="card card-rules">
          <div className="card-title">
            <span className="card-title-main rule"><IconShield size={13} /> Rule control</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('tracks')}>
              Manage rules
            </button>
          </div>
          {rulesGlance.map((s) => {
            const followedToday = data.dailyRecords[today]?.rules?.[s.rule.id]?.status === 'followed';
            return (
              <div className="habit-stat-row" key={s.rule.id}>
                <div className="row" style={{ minWidth: 0 }}>
                  <span className="task-icon rule-icon" style={{ width: 28, height: 28 }}><IconShield size={13} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="task-name truncate">{s.rule.text}</div>
                    <div className="task-meta">
                      <span className={followedToday ? 'success-text' : ''}>
                        {followedToday ? 'Followed today' : 'Not followed today'}
                      </span>
                      {' · '}{s.followedCount}/{s.eligibleCount} days followed
                    </div>
                  </div>
                </div>
                <div className="stat-value" style={{ fontSize: 16 }}>{s.rate === null ? '-' : `${s.rate}%`}</div>
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
        </section>
      )}

      {/* 90-day overview */}
      <section className="card">
        <div className="card-title">
          <span className="card-title-main"><IconCalendar size={14} /> Track overview</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('calendar')}>
            Full calendar
          </button>
        </div>
        <ArcHeatmap
          arc={arc}
          habits={scopedHabits}
          rules={scopedRules}
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
  icon, value, label, sub, tone,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  sub?: string;
  tone?: 'mint' | 'orange' | 'violet' | 'pink' | 'blue';
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon${tone ? ` ${tone}` : ''}`}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}{sub ? ` · ${sub}` : ''}</div>
    </div>
  );
}