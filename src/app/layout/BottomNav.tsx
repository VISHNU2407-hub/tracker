import React from 'react';
import type { PageId } from '../../hooks/useArc';
import { NAV_ENTRIES } from './nav';
import { IconGrid, IconCheckCircle, IconDumbbell, IconChart, IconDots } from '../../components/icons';

interface BottomNavProps {
  page: PageId;
  onNavigate: (p: PageId) => void;
  onMore: () => void;
}

const TABS: { id: PageId | 'more'; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'dashboard', label: 'Home', icon: IconGrid },
  { id: 'today', label: 'Today', icon: IconCheckCircle },
  { id: 'habits', label: 'Habits', icon: IconDumbbell },
  { id: 'stats', label: 'Stats', icon: IconChart },
  { id: 'more', label: 'More', icon: IconDots },
];

/** App-style bottom tab bar — thumb-zone navigation, 48px+ touch targets. */
export function BottomNav({ page, onNavigate, onMore }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((tab) => {
        const active = tab.id === 'more' ? false : page === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            className={`bottom-nav-item${active ? ' active' : ''}`}
            onClick={() => (tab.id === 'more' ? onMore() : onNavigate(tab.id as PageId))}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.label}
          >
            <span className="bottom-nav-icon">
              <Icon size={22} />
            </span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
