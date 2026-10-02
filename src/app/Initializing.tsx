import React from 'react';
import { IconLayers } from '../components/icons';

/** Short initialization screen for installed shells (Electron /
 *  Capacitor). Shown while the shell settles and, on a brand-new
 *  install, while the setup handoff (clipboard probe) runs — then
 *  the app routes straight to the correct screen. The web build
 *  never renders this (boots instantly). */
export function Initializing() {
  return (
    <div className="init-screen" role="status" aria-live="polite">
      <span className="init-mark" aria-hidden="true">
        <IconLayers size={28} />
      </span>
      <span className="init-name">Life System</span>
      <span className="init-text">Preparing your system…</span>
    </div>
  );
}
