import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { MyTracksPage } from '../pages/MyTracks';
import { SettingsPage } from '../pages/Settings';
import { todayISO, dayNumber } from '../services/date';
import { Intro } from './intro/Intro';
import { Initializing } from './Initializing';
import { GetAppsModal } from './layout/GetAppsModal';
import { readEntry, writeEntry, readSetup, currentPlatform, type Platform } from './platform';
import { isSetupComplete } from './passport';

/* Minimum time the initialization screen stays visible in installed
   shells (desktop / Android) — web never renders it. */
const INIT_MIN_MS = 700;

/* ============================================================
   App shell: welcome screen → onboarding gate → page routing.
   The intro layer sits ABOVE everything else and never touches
   tracking state — it only records how the user walked in.
   Mobile-app experience: top app bar, bottom tab navigation,
   "More" bottom sheet, direction-aware screen transitions.
   ============================================================ */

const PAGES: PageId[] = ['dashboard', 'today', 'calendar', 'habits', 'stats', 'reflection', 'tracks', 'settings'];

function pageFromHash(): PageId {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === 'myarc') return 'tracks'; // legacy link → My Tracks
  return (PAGES as string[]).includes(hash) ? (hash as PageId) : 'dashboard';
}

export default function App() {
  const realApi = useAppData();
  const [page, setPage] = useState<PageId>(pageFromHash);
  // Welcome screen: shown until the user picks a way in (independent
  // from winterArc.* tracking keys — replayable from Settings).
  const [introSeen, setIntroSeen] = useState<boolean>(() => readEntry() !== null);

  // Installed shells (Electron / Capacitor) show a short initialization
  // screen while they settle; on a brand-new install the setup handoff
  // (clipboard probe → passport import) runs behind it too. Web boots
  // straight into the correct screen with no splash.
  const installed = currentPlatform() !== 'web';
  const [ready, setReady] = useState(!installed);

  useEffect(() => {
    if (!installed) return;
    let cancelled = false;
    const start = Date.now();
    (async () => {
      if (!isSetupComplete()) {
        // First launch of an installed build: look for the setup passport
        // (Android: clipboard token; desktop: applied in main.tsx inline).
        try {
          const { probeClipboardToken } = await import('./handoff-native');
          if ((await probeClipboardToken()) && !cancelled) {
            window.location.reload(); // apply happened pre-render → reload routes correctly
            return;
          }
        } catch {
          /* no handoff — genuinely new user → welcome screen */
        }
      }
      const wait = Math.max(0, INIT_MIN_MS - (Date.now() - start));
      window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, wait);
    })();
    return () => {
      cancelled = true;
    };
  }, [installed]);

  const enterFromIntro = (platform: Platform) => {
    writeEntry(platform);
    setIntroSeen(true);
  };

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

  // Initialization screen first (installed shells only — web is instant).
  if (!ready) {
    return <Initializing />;
  }

  if (!realApi.loaded) {
    return <div className="onboard"><div className="muted">Loading…</div></div>;
  }

  // Layer 1: welcome / platform choice.
  if (!introSeen) {
    return <Intro arcTitle={realApi.data.arc?.title} onEnter={enterFromIntro} />;
  }

  // Layer 2: first-run setup — runs ONCE. The permanent flag is written
  // when onboarding finishes; users from before the flag existed derive
  // "complete" from their existing data, so nobody is sent back to the
  // wizard. Reset only through Settings → Reset All Data.
  const setupDone =
    readSetup() !== null ||
    (realApi.data.settings.onboarded === true && realApi.data.arc !== null);
  if (!setupDone) {
    return <Onboarding api={realApi} />;
  }

  // Layer 3: the tracker itself. If the user has no tracks left (e.g. they
  // deleted every one), route to My Tracks — its empty state offers
  // Create Track. This NEVER re-runs the setup wizard on existing data.
  const effectivePage: PageId = realApi.data.arc ? page : 'tracks';
  return <Shell api={realApi} page={effectivePage} setPage={navigate} />;
}

function Shell({ api, page, setPage }: { api: AppDataApi; page: PageId; setPage: (p: PageId) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);

  // Direction-aware transitions: mobile feels like a stack — moving to a
  // later tab slides in from the right, earlier tabs from the left.
  const prevPageRef = useRef<PageId>(page);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  useEffect(() => {
    if (page === prevPageRef.current) return;
    setDirection(NAV_ORDER.indexOf(page) >= NAV_ORDER.indexOf(prevPageRef.current) ? 'forward' : 'back');
    prevPageRef.current = page;
  }, [page]);

  const arc = api.data.arc!;

  const pages: Record<PageId, React.ReactNode> = {
    dashboard: <DashboardPage api={api} onNavigate={setPage} />,
    today: <TodayPage api={api} onNavigate={setPage} />,
    calendar: <CalendarPage api={api} />,
    habits: <HabitsPage api={api} />,
    stats: <StatsPage api={api} />,
    reflection: <ReflectionPage api={api} />,
    tracks: <MyTracksPage api={api} />,
    settings: <SettingsPage api={api} />,
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
        arcTitle={arc?.title}
      />

      {/* Mobile: app-style chrome — top bar, animated screen, bottom tabs */}
      <div className="mobile-frame">
        <AppTopBar
          page={page}
          dayNumber={arc ? dayNumber(todayISO(), arc.startDate, arc.durationDays) : undefined}
          arcTitle={arc?.title}
        />
        <main className={`app-main screen-enter-${direction === 'forward' ? 'fwd' : 'back'}`} key={page}>
          {current}
        </main>
      </div>

      <BottomNav page={page} onNavigate={go} onMore={() => setMoreOpen(true)} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        current={page}
        onNavigate={go}
        onGetApps={() => {
          setMoreOpen(false);
          setAppsOpen(true);
        }}
      />
      <GetAppsModal open={appsOpen} onClose={() => setAppsOpen(false)} />
      <InstallBanner />
    </div>
  );
}
