import React, { useEffect, useState } from 'react';
import { IconSnowflake, IconX } from '../../components/icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'winterArc.installDismissed';

/** Subtle install prompt — shows once the browser fires beforeinstallprompt.
 *  Dismissal is remembered; never nags. */
export function InstallBanner() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!evt || installed || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="install-banner" role="dialog" aria-label="Install Life System">
      <span className="install-icon"><IconSnowflake size={18} /></span>
      <div className="install-text">
        <strong>Install Life System</strong>
        <span>Add to your home screen — works offline</span>
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={async () => {
          await evt.prompt();
          setEvt(null);
        }}
      >
        Install
      </button>
      <button type="button" className="btn btn-ghost btn-icon" onClick={dismiss} aria-label="Dismiss install prompt">
        <IconX size={15} />
      </button>
    </div>
  );
}
