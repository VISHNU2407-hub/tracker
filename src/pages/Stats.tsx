import React, { useMemo } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { useAnalytics, trackScope } from '../hooks/useArc';
import { PageHeader } from '../app/layout/PageHeader';
import { IconFor } from './Habits';
import {
  computeTrend, computeWeeklyTrend,
} from '../services/analytics';
import { formatShort } from '../services/date';
import { LineChart, BarChart } from '../components/ui/Charts';
import { IconFlame, IconTrophy, IconSpark, IconChart, IconShield } from '../components/icons';

/* ============================================================
   Stats page (spec §3): all values derived from real records.
   Charts include text summaries (spec §10 accessibility).
   v2: habit stats measure what you DID; a Rule control section
   measures what you CONTROLLED.
   ============================================================ */

type Range = 7 | 30 | 90;

export function StatsPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const arc = data.arc!;
  const { stats, habitStats, ruleStats } = useAnalytics(data);
  const { habits: scopedHabits, rules: scopedRules } = trackScope(data);
  const [range, setRange] = React.useState<Range>(30);

  const trend = useMemo(
    () => computeTrend(arc, scopedHabits, scopedRules, data.dailyRecords, range),
    [arc, scopedHabits, scopedRules, data.dailyRecords, range]
  );

  // 7-point rolling average — gives the daily line calm, readable context.
  const trendPoints = useMemo(() => {
    return trend.map((p, i) => {
      const win = trend.slice(Math.max(0, i - 6), i + 1).filter((q) => q.pct !== null);
      return {
        label: p.date,
        value: p.pct,
        sub: win.length === 0 ? null : Math.round(win.reduce((s, q) => s + (q.pct ?? 0), 0) / win.length),
      };
    });
  }, [trend]);

  const weekly = useMemo(
    () => computeWeeklyTrend(arc, scopedHabits, scopedRules, data.dailyRecords, 13),
    [arc, scopedHabits, scopedRules, data.dailyRecords]
  );

  const trendSummary = useMemo(() => {
    const pts = trend.filter((p) => p.pct !== null);
    if (pts.length === 0) return 'No tracked days in this range yet.';
    const avg = Math.round(pts.reduce((s, p) => s + (p.pct ?? 0), 0) / pts.length);
    const perfect = trend.filter((p) => p.pct === 100).length;
    const active = trend.filter((p) => p.pct !== null && p.pct > 0).length;
    return `Last ${range} track days: ${pts.length} day${pts.length === 1 ? '' : 's'} with items, ${active} with progress, ${perfect} perfect, ${avg}% average completion.`;
  }, [trend, range]);

  const ruleAgg = useMemo(() => {
    const followed = ruleStats.reduce((s, r) => s + r.followedCount, 0);
    const eligible = ruleStats.reduce((s, r) => s + r.eligibleCount, 0);
    return { followed, eligible, pct: eligible === 0 ? null : Math.round((followed / eligible) * 100) };
  }, [ruleStats]);

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
        <div className="stat-card">
          <div className="stat-icon"><IconShield size={16} /></div>
          <div className="stat-value">{ruleAgg.pct === null ? '—' : `${ruleAgg.pct}%`}</div>
          <div className="stat-label">Rule control</div>
        </div>
      </section>

      {/* Trend chart */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          <span className="card-title-main"><IconChart size={14} /> Completion trend</span>
          <div className="segmented" style={{ width: 'auto' }} role="group" aria-label="Trend range">
            {([7, 30, 90] as Range[]).map((r) => (
              <button key={r} type="button" className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
                {r}d
              </button>
            ))}
          </div>
        </div>

        <p className="small secondary" style={{ marginBottom: 14 }}>{trendSummary}</p>

        <LineChart
          points={trendPoints}
          height={210}
          ariaLabel={`Completion trend for last ${range} days. ${trendSummary}`}
        />
        {trendPoints.some((p) => p.sub !== null) && (
          <div className="row small muted" style={{ gap: 6, marginTop: 8 }}>
            <span style={{ width: 18, height: 0, borderTop: '2px dashed var(--chart-avg)', display: 'inline-block' }} />
            7-day rolling average · solid line = daily completion
          </div>
        )}
      </section>

      {/* Weekly buckets */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-title"><span className="card-title-main"><IconChart size={14} /> Weekly averages — full arc</span></div>
        {weekly.length === 0 ? (
          <p className="secondary small">No data yet — your weekly averages appear after your first tracked day.</p>
        ) : (
          <>
            <BarChart
              points={weekly.map((w) => ({ label: formatShort(w.date), value: w.pct }))}
              height={180}
              ariaLabel="Weekly average completion"
            />
            <p className="small muted" style={{ marginTop: 8 }}>
              Average daily completion per week, from {formatShort(weekly[0].date)} to {formatShort(weekly[weekly.length - 1].date)} · newest at right.
            </p>
          </>
        )}
      </section>

      {/* Habit analytics — what you DID */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-title"><span>Habit performance — what you did</span></div>
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

      {/* Rule control — what you CONTROLLED */}
      <section className="card card-rules">
<div className="card-title">
          <span className="card-title-main rule"><IconShield size={14} /> Rule control - what you controlled</span>
        </div>
        {ruleStats.length === 0 ? (
          <p className="secondary small">No rules yet — add them in My Tracks to track your self-control.</p>
        ) : (
          <>
            <div className="habit-stat-row" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="small muted">Rule</span>
              <span className="small muted">Rate</span>
              <span className="small muted hs-bar">Days followed</span>
              <span className="small muted hs-streak">Streak now / best</span>
            </div>
            {ruleStats.map((s) => (
              <div className="habit-stat-row" key={s.rule.id}>
                <div className="row" style={{ minWidth: 0 }}>
                  <span className="task-icon rule-icon" style={{ width: 28, height: 28 }}><IconShield size={13} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="task-name truncate">{s.rule.text}</div>
                    <div className="task-meta">
                      {s.followedCount}/{s.eligibleCount} days followed{s.brokenCount > 0 ? ` · ${s.brokenCount} broken` : ' · none broken'}
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
            ))}
          </>
        )}
      </section>
    </div>
  );
}
