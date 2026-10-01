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
} from '../components/icons';
import {
  formatDateRange, formatShort, todayISO, addDays, dayNumber,
} from '../services/date';
import { isArcComplete } from '../services/analytics';

/* ============================================================
   Dashboard (spec §3): hero, quick stats, today's tasks,
   progress ring, 90-day overview — all from real stored data.
   ============================================================ */

export function DashboardPage({ api, onNavigate }: { api: AppDataApi; onNavigate: (p: PageId) => void }) {
  const { data } = api;
  const arc = data.arc!;
  const today = todayISO();
  const { stats, evaluate } = useAnalytics(data);
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
            <span>Today's tasks</span>
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
