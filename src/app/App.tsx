import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../hooks/useAppData';
import type { AppDataApi } from '../hooks/useAppData';
import type { PageId } from '../hooks/useArc';
import { Sidebar } from './layout/Sidebar';
import { BottomNav } from './layout/BottomNav';
import { AppTopBar } from './layout/AppTopBar';
import { MoreSheet } from './layout/MoreSheet';
import { InstallBanner } from './layout/InstallBanner';
import { NAV_ORDER } from './layout/nav';
import { Onboarding } from '../pages/Onboarding';
import { DashboardPage } from '../pages/Dashboard';
import { TodayPage } from '../pages/Today';
import { CalendarPage } from '../pages/Calendar';
import { HabitsPage } from '../pages/Habits';
import { StatsPage } from '../pages/Stats';
import { ReflectionPage } from '../pages/Reflection';
import { MyArcPage } from '../pages/MyArc';
import { SettingsPage } from '../pages/Settings';
import { useAnalytics } from '../hooks/useArc';
import { buildDemoData } from '../services/demoData';
import { todayISO, dayNumber } from '../services/date';

/* ============================================================
   App shell: onboarding gate + page routing + demo mode.
   Mobile-app experience: top app bar, bottom tab navigation,
   "More" bottom sheet, direction-aware screen transitions.
   Demo mode swaps the data fed to pages; real data untouched.
   ============================================================ */

const PAGES: PageId[] = ['dashboard', 'today', 'calendar', 'habits', 'stats', 'reflection', 'myarc', 'settings'];

function pageFromHash(): PageId {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return (PAGES as string[]).includes(hash) ? (hash as PageId) : 'dashboard';
}

export default function App() {
  const realApi = useAppData();
  const [page, setPage] = useState<PageId>(pageFromHash);

  // Keep the URL hash in sync and follow browser Back/Forward.
  useEffect(() => {
    const apply = () => setPage(pageFromHash());
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const navigate = (p: PageId) => {
    if (p !== page) window.location.hash = p; // pushes a history entry → Back works
    setPage(p);
  };

  if (!realApi.loaded) {
    return <div className="onboard"><div className="muted">Loading…</div></div>;
  }

  // First run → onboarding wizard.
  if (!realApi.data.settings.onboarded || !realApi.data.arc) {
    return <Onboarding api={realApi} />;
  }

  return <Shell api={realApi} page={page} setPage={navigate} />;
}

function Shell({ api, page, setPage }: { api: AppDataApi; page: PageId; setPage: (p: PageId) => void }) {
  const demo = api.data.settings.demoMode;
  const [moreOpen, setMoreOpen] = useState(false);

  // Direction-aware transitions: mobile feels like a stack — moving to a
  // later tab slides in from the right, earlier tabs from the left.
  const prevPageRef = useRef<PageId>(page);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  useEffect(() => {
    if (page === prevPageRef.current) return;
    setDirection(NAV_ORDER.indexOf(page) >= NAV_ORDER.indexOf(prevPageRef.current) ? 'forward' : 'back');
    prevPageRef.current = page;
  }, [page]);

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
      addRule: (text) => ({ id: 'demo_blocked', text, active: true, fromDay: 1, createdAt: new Date().toISOString(), order: 999 }),
      updateRule: () => undefined,
      archiveRule: () => undefined,
      restoreRule: () => undefined,
      deleteRulePermanently: () => undefined,
      reorderRules: () => undefined,
      setRuleStatus: () => undefined,
      saveReflection: () => undefined,
      deleteReflection: () => undefined,
    };
  }, [api, demo]);

  const { stats } = useAnalytics(effectiveApi.data);
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

  // Only the active page is mounted (native-app feel; transitions animate
  // the entering screen — subtle 160ms, no exit animations needed).
  const current = pages[page];

  const go = useCallback(
    (p: PageId) => {
      setMoreOpen(false);
      setPage(p);
    },
    [setPage]
  );

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        dayNumber={arc ? dayNumber(todayISO(), arc.startDate, arc.durationDays) : undefined}
        arcStatus={arc?.status ?? null}
      />

      {/* Mobile: app-style chrome — top bar, animated screen, bottom tabs */}
      <div className="mobile-frame">
        <AppTopBar page={page} dayNumber={arc ? dayNumber(todayISO(), arc.startDate, arc.durationDays) : undefined} />
        <main className={`app-main screen-enter-${direction === 'forward' ? 'fwd' : 'back'}`} key={page}>
          {current}
        </main>
      </div>

      <BottomNav page={page} onNavigate={go} onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} current={page} onNavigate={go} />
      <InstallBanner />

      {demo && (
        <button
          type="button"
          className="toast toast-demo"
          onClick={() => api.setDemoMode(false)}
          aria-label="Exit demo mode"
        >
          Demo mode — tap to exit
        </button>
      )}
    </div>
  );
}
