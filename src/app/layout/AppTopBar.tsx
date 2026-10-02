import React from 'react';
import type { PageId } from '../../hooks/useArc';
import { IconLayers, IconPlus } from '../../components/icons';

interface AppTopBarProps {
  page: PageId;
  dayNumber?: number;
  arcTitle?: string;
}

const TITLE: Record<PageId, string> = {
  dashboard: 'Life System',
  today: 'Today',
  calendar: 'Calendar',
  habits: 'Habits',
  stats: 'Stats',
  reflection: 'Reflection',
  tracks: 'My Tracks',
  settings: 'Settings',
};

/** Mobile top app bar: brand identity, current screen title, one-hand actions. */
export function AppTopBar({ page, dayNumber, arcTitle }: AppTopBarProps) {
  const dashTitle = arcTitle?.trim() || TITLE.dashboard;
  return (
    <header className="app-topbar">
      <div className="topbar-brand" aria-hidden="true">
        <IconLayers size={17} />
      </div>
      <div className="topbar-title">
        <span className="topbar-page">{page === 'dashboard' ? dashTitle : TITLE[page]}</span>
        {page === 'dashboard' && typeof dayNumber === 'number' && (
          <span className="topbar-day">Day {dayNumber}</span>
        )}
      </div>
      {page === 'habits' ? (
        <span style={{ width: 34 }} aria-hidden="true" />
      ) : (
        <span className="topbar-spacer" aria-hidden="true" />
      )}
    </header>
  );
}

export { IconPlus };
