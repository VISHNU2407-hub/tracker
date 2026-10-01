import React from 'react';
import type { PageId } from '../../hooks/useArc';
import { IconSnowflake, IconPlus } from '../../components/icons';

interface AppTopBarProps {
  page: PageId;
  dayNumber?: number;
}

const TITLE: Record<PageId, string> = {
  dashboard: 'Winter Arc',
  today: 'Today',
  calendar: 'Calendar',
  habits: 'Habits',
  stats: 'Stats',
  reflection: 'Reflection',
  myarc: 'My Arc',
  settings: 'Settings',
};

/** Mobile top app bar: brand identity, current screen title, one-hand actions. */
export function AppTopBar({ page, dayNumber }: AppTopBarProps) {
  return (
    <header className="app-topbar">
      <div className="topbar-brand" aria-hidden="true">
        <IconSnowflake size={17} />
      </div>
      <div className="topbar-title">
        <span className="topbar-page">{TITLE[page]}</span>
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
