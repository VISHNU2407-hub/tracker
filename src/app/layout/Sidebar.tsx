import React from 'react';
import { IconLayers } from '../../components/icons';
import { NAV_ENTRIES } from './nav';
import type { PageId } from '../../hooks/useArc';

interface SidebarProps {
  page: PageId;
  onNavigate: (p: PageId) => void;
  dayNumber?: number;
  arcStatus?: string | null;
  arcTitle?: string;
}

export function Sidebar({ page, onNavigate, dayNumber, arcStatus, arcTitle }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <IconLayers size={18} />
        </div>
        <div>
          <div className="sidebar-brand-text">LIFE SYSTEM</div>
          <div className="sidebar-brand-sub">{arcTitle?.trim() || 'Year-round life tracking'}</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ENTRIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`nav-item${page === entry.id ? ' active' : ''}`}
            onClick={() => onNavigate(entry.id)}
            aria-current={page === entry.id ? 'page' : undefined}
          >
            <entry.icon size={17} />
            {entry.label}
            {entry.id === 'dashboard' && typeof dayNumber === 'number' && (
              <span className="nav-day-badge">D{dayNumber}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          <span className="sidebar-status-dot" aria-hidden="true" />
          <span>{arcStatus === 'active' ? 'Track active' : arcStatus ? `Track ${arcStatus}` : 'Local data'}</span>
        </div>
      </div>
    </aside>
  );
}
