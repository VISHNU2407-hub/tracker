import React from 'react';
import { Modal } from '../../components/ui/Modal';
import { IconDesktop, IconPhone } from '../../components/icons';
import { RELEASES_URL } from '../platform';
import { handoffToInstalledApp } from '../passport';

interface GetAppsModalProps {
  open: boolean;
  onClose: () => void;
}

/** Post-setup download surface (More → Get the apps). Hands the completed
 *  setup to an installed build — passport file for desktop, clipboard
 *  token for Android — then opens the releases page. This is NOT a
 *  platform-selection screen: it never gates entry into the tracker,
 *  which stays a first-time-setup-only concern. */
export function GetAppsModal({ open, onClose }: GetAppsModalProps) {
  if (!open) return null;

  const get = () => {
    handoffToInstalledApp(); // passport file + clipboard token (no-op pre-setup)
    window.open(RELEASES_URL, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <Modal title="Get the apps" onClose={onClose} wide>
      <div className="intro-sheet">
        <p className="secondary">
          Install Life System on desktop or Android. Your setup travels with you —
          the installed app opens straight into your tracker, no repeat onboarding.
        </p>

        <div className="intro-sheet-block">
          <div className="intro-sheet-label">Download</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={get}>
              <IconDesktop size={15} /> Desktop app
            </button>
            <button type="button" className="btn" onClick={get}>
              <IconPhone size={15} /> Android app
            </button>
          </div>
          <span className="small muted">
            Installers and APKs are published on the releases page.
          </span>
        </div>
      </div>
    </Modal>
  );
}
