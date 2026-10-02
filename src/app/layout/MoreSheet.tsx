import React, { useEffect, useRef } from 'react';
import type { PageId } from '../../hooks/useArc';
import { NAV_ENTRIES } from './nav';
import { IconX, IconDownload } from '../../components/icons';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  current: PageId;
  onNavigate: (p: PageId) => void;
  /** Optional: post-setup "Get the apps" download entry (with setup handoff). */
  onGetApps?: () => void;
}

const MORE_PAGES: PageId[] = ['calendar', 'reflection', 'tracks', 'settings'];

/** Mobile "More" bottom sheet — secondary screens behind the More tab. */
export function MoreSheet({ open, onClose, current, onNavigate, onGetApps }: MoreSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Focus the first item for keyboard/screen-reader users.
    requestAnimationFrame(() => {
      sheetRef.current?.querySelector<HTMLElement>('button')?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const entries = MORE_PAGES.map((id) => NAV_ENTRIES.find((e) => e.id === id)!).filter(Boolean);

  return (
    <div
      className="sheet-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="More screens" ref={sheetRef}>
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-head">
          <span className="sheet-title">More</span>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close menu">
            <IconX size={17} />
          </button>
        </div>
        <div className="sheet-grid">
          {entries.map((e) => {
            const Icon = e.icon;
            const active = current === e.id;
            return (
              <button
                key={e.id}
                type="button"
                className={`sheet-item${active ? ' active' : ''}`}
                onClick={() => onNavigate(e.id)}
              >
                <span className="sheet-item-icon"><Icon size={20} /></span>
                <span className="sheet-item-label">{e.label}</span>
                {active && <span className="sheet-item-active" aria-label="current screen" />}
              </button>
            );
          })}
          {onGetApps && (
            <button type="button" className="sheet-item" onClick={onGetApps}>
              <span className="sheet-item-icon"><IconDownload size={20} /></span>
              <span className="sheet-item-label">Get the apps</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
