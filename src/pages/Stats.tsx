import React, { useMemo } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { useAnalytics } from '../hooks/useArc';
import { PageHeader } from '../components/layout/PageHeader';
import { IconFor } from './Habits';
import {
  computeTrend, computeWeeklyTrend,
} from '../services/analytics';
import { formatShort } from '../services/date';
import { IconFlame, IconTrophy, IconSpark, IconChart, IconTarget } from '../components/icons';

/* ============================================================
   Stats page (spec §3): all values derived from real records.
   Charts include text summaries (spec §10 accessibility).
   ============================================================ */

type Range = 7 | 30 | 90;

export function StatsPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const arc = data.arc!;
  const { stats, habitStats } = useAnalytics(data);
  const [range, setRange] = React.useState<Range>(30);

  const trend = useMemo(
    () => computeTrend(arc, data.habits, data.dailyRecords, range),
    [arc, data.habits, data.dailyRecords, range]
  );

  const weekly = useMemo(
    () => computeWeeklyTrend(arc, data.habits, data.dailyRecords, 13),
    [arc, data.habits, data.dailyRecords]
  );

  const trendSummary = useMemo(() => {
    const pts = trend.filter((p) => p.pct !== null);
    if (pts.length === 0) return 'No tracked days in this range yet.';
    const avg = Math.round(pts.reduce((s, p) => s + (p.pct ?? 0), 0) / pts.length);
    const perfect = trend.filter((p) => p.pct === 100).length;
    const active = trend.filter((p) => p.pct !== null && p.pct > 0).length;
    return `Last ${range} arc days: ${pts.length} day${pts.length === 1 ? '' : 's'} with habits, ${active} with progress, ${perfect} perfect, ${avg}% average completion.`;
  }, [trend, range]);

  return (
    <div>
      <PageHeader title="Stats" sub="Honest numbers from your records. Nothing here is faked." />

      {/* Overall stat cards */}
      <section className="stats-row" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon"><IconChart size={16} /></div>
          <div className="stat-value">{stats?.totalPct ?? '—'}%</div>
          <div className="stat-label">Overall completion</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><IconFlame size={16} /></div>
          <div className="stat-value">{stats?.streaks.current ?? 0}</div>
          <div className="stat-label">Current streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><IconTrophy size={16} /></div>
          <div className="stat-value">{stats?.streaks.best ?? 0}</div>
          <div className="stat-label">Longest streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><IconSpark size={16} /></div>
          <div className="stat-value">{stats?.perfectDays ?? 0}</div>
          <div className="stat-label">Perfect days</div>
        </div>
      </section>

      {/* Trend chart */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <span>Completion trend</span>
          <div className="segmented" style={{ width: 'auto' }} role="group" aria-label="Trend range">
            {([7, 30, 90] as Range[]).map((r) => (
              <button key={r} type="button" className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
                {r}d
              </button>
            ))}
          </div>
        </div>

        <p className="small secondary" style={{ marginBottom: 10 }}>{trendSummary}</p>

        <div className="trend-chart" role="img" aria-label={`Completion trend for last ${range} days. ${trendSummary}`}>
          {trend.map((p) => (
            <div
              key={p.date}
              className={`trend-bar${p.pct === null ? ' none' : ''}`}
              style={{ height: `${p.pct === null ? 3 : Math.max(3, p.pct)}%` }}
              title={`${formatShort(p.date)}: ${p.pct === null ? 'no habits' : `${p.pct}%`}`}
            />
          ))}
        </div>
        <div className="trend-axis">
          <span>{trend.length ? formatShort(trend[0].date) : ''}</span>
          <span>{trend.length ? formatShort(trend[trend.length - 1].date) : ''}</span>
        </div>
      </section>

      {/* Weekly buckets */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-title"><span>Weekly averages (full arc)</span></div>
        {weekly.length === 0 ? (
          <p className="secondary small">No data yet — your weekly averages appear after your first tracked day.</p>
        ) : (
          <>
            <div className="trend-chart" style={{ height: 90 }} role="img" aria-label="Weekly average completion">
              {weekly.map((w, i) => (
                <div
                  key={i}
                  className="trend-bar"
                  style={{ height: `${Math.max(3, w.pct ?? 0)}%` }}
                  title={`Week of ${formatShort(w.date)}: ${w.pct}%`}
                />
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              Weekly buckets from {formatShort(weekly[0].date)} to {formatShort(weekly[weekly.length - 1].date)} · newest at right.
            </p>
          </>
        )}
      </section>

      {/* Habit analytics */}
      <section className="card">
        <div className="card-title"><span>Habit performance</span></div>
        {habitStats.length === 0 ? (
          <p className="secondary small">No habits yet.</p>
        ) : (
          <div>
            <div className="habit-stat-row" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="small muted">Habit</span>
              <span className="small muted">Rate</span>
              <span className="small muted hs-bar">Share of eligible days</span>
              <span className="small muted hs-streak">Streak now / best</span>
            </div>
            {habitStats.map((s) => {
              const Icon = IconFor(s.habit.icon);
              return (
                <div className="habit-stat-row" key={s.habit.id}>
                  <div className="row" style={{ minWidth: 0 }}>
                    <span className="task-icon" style={{ width: 28, height: 28 }}><Icon size={13} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="task-name truncate">{s.habit.name}</div>
                      <div className="task-meta">
                        {s.completedCount}/{s.eligibleCount} days · {s.totalValue > 0 ? `${s.totalValue} ${s.habit.unit || ''} logged` : 'no values logged'}
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
    </div>
  );
}
