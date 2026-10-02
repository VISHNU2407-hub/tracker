import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { consumeInlineHandoff } from './app/passport';
import './styles/theme.css';
import './styles/components.css';
import './styles/intro.css';

// Cross-platform setup handoff: Electron injects the passport as
// window.__LIFESYSTEM_HANDOFF__ — apply it before the first render so
// a returning installed user goes straight past welcome/onboarding.
consumeInlineHandoff();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: register the service worker (production only — the dev server has no
// real /sw.js, and installing it there would cache stale dev chunks).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {
      /* offline support is best-effort; app works without it */
    });
  });
}
