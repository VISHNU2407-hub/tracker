import React from 'react';
import { IconSnowflake } from '../icons';
import { NAV_ENTRIES } from './nav';
import type { PageId } from '../../hooks/useArc';

interface MobileNavProps {
  page: PageId;
  onNavigate: (p: PageId) => void;
}

/** Mobile top bar + bottom tab navigation (large touch targets, spec §7). */
export function MobileNav({ page, onNavigate }: MobileNavProps) {
  // Bottom bar shows the most-used pages first.
  const bottomIds: PageId[] = ['dashboard', 'today', 'calendar', 'habits', 'stats'];
  const bottom = NAV_ENTRIES.filter((e) => bottomIds.includes(e.id));

  return (
    <>
      <div className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <IconSnowflake size={16} />
          WINTER ARC
        </div>
        <select
          className="select"
          style={{ width: 'auto', minHeight: 36, fontSize: 13, padding: '6px 10px' }}
          value={page}
          onChange={(e) => onNavigate(e.target.value as PageId)}
          aria-label="Go to page"
        >
          {NAV_ENTRIES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <nav className="mobile-nav" aria-label="Bottom navigation">
        {bottom.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`mobile-nav-item${page === entry.id ? ' active' : ''}`}
            onClick={() => onNavigate(entry.id)}
            aria-current={page === entry.id ? 'page' : undefined}
          >
            <entry.icon size={20} />
            {entry.label}
          </button>
        ))}
      </nav>
    </>
  );
}
