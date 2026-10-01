import React, { useMemo, useState } from 'react';
import { useAppData } from './hooks/useAppData';
import type { AppDataApi } from './hooks/useAppData';
import type { PageId } from './hooks/useArc';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { Onboarding } from './pages/Onboarding';
import { DashboardPage } from './pages/Dashboard';
import { TodayPage } from './pages/Today';
import { CalendarPage } from './pages/Calendar';
import { HabitsPage } from './pages/Habits';
import { StatsPage } from './pages/Stats';
import { ReflectionPage } from './pages/Reflection';
import { MyArcPage } from './pages/MyArc';
import { SettingsPage } from './pages/Settings';
import { useAnalytics } from './hooks/useArc';
import { buildDemoData } from './services/demoData';
import { todayISO, dayNumber } from './services/date';

/* ============================================================
   App shell: onboarding gate + page routing + demo mode.
   Demo mode swaps the data fed to pages; real data untouched.
   ============================================================ */

export default function App() {
  const realApi = useAppData();
  const [page, setPage] = useState<PageId>('dashboard');

  if (!realApi.loaded) {
    return <div className="onboard"><div className="muted">Loading…</div></div>;
  }

  // First run → onboarding wizard.
  if (!realApi.data.settings.onboarded || !realApi.data.arc) {
    return <Onboarding api={realApi} />;
  }

  return <Shell api={realApi} page={page} setPage={setPage} />;
}

function Shell({ api, page, setPage }: { api: AppDataApi; page: PageId; setPage: (p: PageId) => void }) {
  const demo = api.data.settings.demoMode;

  // Demo mode: feed pages a synthetic dataset and block mutations,
  // so the preview can never modify stored user data.
  const effectiveApi = useMemo<AppDataApi>(() => {
    if (!demo) return api;
    const demoData = buildDemoData(api.data);
    return {
      ...api,
      data: demoData,
      setHabitValue: () => undefined,
      toggleHabit: () => undefined,
      setDayNote: () => undefined,
      addHabit: (h) => ({ ...h, id: 'demo_blocked', active: true, createdAt: new Date().toISOString(), order: 999 }),
      updateHabit: () => undefined,
      archiveHabit: () => undefined,
      restoreHabit: () => undefined,
      deleteHabitPermanently: () => undefined,
      reorderHabits: () => undefined,
      saveReflection: () => undefined,
      deleteReflection: () => undefined,
    };
  }, [api, demo]);

  const { stats } = useAnalytics(effectiveDataOf(effectiveApi));
  const arc = effectiveApi.data.arc!;

  const pages: Record<PageId, React.ReactNode> = {
    dashboard: <DashboardPage api={effectiveApi} onNavigate={setPage} />,
    today: <TodayPage api={effectiveApi} onNavigate={setPage} />,
    calendar: <CalendarPage api={effectiveApi} />,
    habits: <HabitsPage api={effectiveApi} />,
    stats: <StatsPage api={effectiveApi} />,
    reflection: <ReflectionPage api={effectiveApi} />,
    myarc: <MyArcPage api={effectiveApi} />,
    settings: <SettingsPage api={effectiveApi} />,
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        dayNumber={arc ? dayNumber(todayISO(), arc.startDate, arc.durationDays) : undefined}
        arcStatus={arc?.status ?? null}
      />
      <MobileNav page={page} onNavigate={setPage} />
      <main className="app-main">{pages[page]}</main>
      {demo && (
        <button
          type="button"
          className="toast"
          style={{ bottom: 90, cursor: 'pointer', border: 'none', background: 'var(--accent-dim)', color: 'var(--accent)' }}
          onClick={() => api.setDemoMode(false)}
          aria-label="Exit demo mode"
        >
          Demo mode — tap to exit
        </button>
      )}
    </div>
  );
}

function effectiveDataOf(api: AppDataApi) {
  return api.data;
}
