import React, { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import {
  IconLayers, IconCheckCircle, IconShield, IconTarget, IconFlame,
  IconTrophy, IconBook, IconChart, IconDesktop, IconPhone, IconGlobe,
  IconArrowLeft, IconDownload,
} from '../../components/icons';
import {
  currentPlatform, describeOS, DESKTOP_DOWNLOAD_URL, ANDROID_DOWNLOAD_URL,
  type Platform,
} from '../platform';
import { handoffToInstalledApp } from '../passport';

/* ============================================================
   Welcome / intro screen — the layer ABOVE the tracker.

   One product (a personal life system), one tracker, three ways
   in: Desktop shell, Android shell, or the plain web build.
   Nothing here touches tracking state or winterArc.* keys.
   ============================================================ */

interface IntroProps {
  /** Active track title, when one exists (e.g. "Winter Arc"). */
  arcTitle?: string;
  onEnter: (platform: Platform) => void;
}

interface Feature {
  icon: React.FC<{ size?: number }>;
  title: string;
  text: string;
}

const FEATURES: Feature[] = [
  {
    icon: IconCheckCircle,
    title: 'Habits',
    text: 'Checkbox, numeric and duration targets — logged once a day, kept forever.',
  },
  {
    icon: IconShield,
    title: 'Rules & self-control',
    text: 'The lines you set for yourself, marked kept or broken every day.',
  },
  {
    icon: IconTarget,
    title: 'Daily progress',
    text: 'One honest score per day, habits and rules combined.',
  },
  {
    icon: IconFlame,
    title: 'Streaks',
    text: 'Current streak, best streak and perfect days — computed from real records.',
  },
  {
    icon: IconTrophy,
    title: 'Tracks & challenges',
    text: 'Create your own tracks — a season like Winter Arc, a fitness journey, anything.',
  },
  {
    icon: IconBook,
    title: 'Reflection',
    text: 'A weekly check-in: what went well, what to improve, what is next.',
  },
  {
    icon: IconChart,
    title: 'Long-term consistency',
    text: '7 / 30 / 90-day trends, heatmaps and stats that never flatter you.',
  },
];

interface PlatformCard {
  id: Platform;
  icon: React.FC<{ size?: number }>;
  title: string;
  meta: string;
  blurb: string;
}

const CARDS: PlatformCard[] = [
  {
    id: 'desktop',
    icon: IconDesktop,
    title: 'Install on Desktop',
    meta: 'Windows · macOS · Linux',
    blurb: 'A standalone window with its own taskbar and dock entry.',
  },
  {
    id: 'android',
    icon: IconPhone,
    title: 'Install on Android',
    meta: 'Phone & tablet',
    blurb: 'A real app on your home screen — touch-first, works offline.',
  },
  {
    id: 'web',
    icon: IconGlobe,
    title: 'Continue on Web',
    meta: 'Any modern browser',
    blurb: 'No install needed — open the tracker right where you are.',
  },
];

/** User-facing download info for the install sheets — direct links to the
 *  published GitHub release assets (no build commands, no dev instructions). */
interface DownloadInfo {
  href: string;
  label: string;
  detail: string;
  hint: string;
}

const DOWNLOADS: Record<Exclude<Platform, 'web'>, DownloadInfo> = {
  desktop: {
    href: DESKTOP_DOWNLOAD_URL,
    label: 'Download for Windows',
    detail: 'Windows installer (.exe) — from the latest GitHub release.',
    hint: 'Open the downloaded installer to install Life System on Windows.',
  },
  android: {
    href: ANDROID_DOWNLOAD_URL,
    label: 'Download APK',
    detail: 'Android package (.apk) — from the latest GitHub release.',
    hint: 'Open the downloaded APK to install Life System on Android.',
  },
};

export function Intro({ arcTitle, onEnter }: IntroProps) {
  const platform = useMemo(() => currentPlatform(), []);
  const [sheet, setSheet] = useState<Exclude<Platform, 'web'> | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const challenge = arcTitle?.trim() || 'My Tracks';

  const cardAction = (card: PlatformCard) => {
    if (card.id === 'web' || card.id === platform) {
      onEnter(card.id);
      return;
    }
    setDownloaded(false);
    setSheet(card.id as Exclude<Platform, 'web'>);
  };

  const buttonLabel = (card: PlatformCard) => {
    if (card.id === 'web') return 'Continue on Web';
    if (card.id === platform) return card.id === 'desktop' ? 'Enter Desktop App' : 'Enter Android App';
    return card.title;
  };

  return (
    <div className="intro">
      {/* ---------- Top bar ---------- */}
      <header className="intro-top">
        <div className="intro-brand">
          <span className="intro-brand-icon" aria-hidden="true"><IconLayers size={17} /></span>
          <span className="intro-brand-name">Life System</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEnter('web')}>
          Skip to tracker
        </button>
      </header>

      <main className="intro-main">
        {/* ---------- Hero ---------- */}
        <section className="intro-hero">
          <div className="intro-hero-copy intro-rise">
            <span className="intro-eyebrow">Personal life system</span>
            <h1 className="intro-title">
              Your Life. Your Progress. <span className="intro-title-accent">Your System.</span>
            </h1>
            <p className="intro-lead">
              Build the habits you want, keep the rules you set, and see an honest
              picture of how consistent you really are — one private,
              local-first system for the person you are working on.
            </p>
            <div className="intro-chips" aria-label="Core capabilities">
              <span className="intro-chip">Habits</span>
              <span className="intro-chip">Rules</span>
              <span className="intro-chip">Streaks</span>
              <span className="intro-chip">Progress</span>
              <span className="intro-chip">Reflection</span>
            </div>
          </div>

          <aside className="intro-hero-card intro-rise intro-delay-1">
            <div className="intro-hero-card-label">Your active track</div>
            <div className="intro-hero-card-title">{challenge}</div>
            <p className="intro-hero-card-text">
              A track is one challenge inside the continuous Life System — name it,
              set a duration and goal, and pick the habits and rules it includes.
              Everything else (habits, stats, reflection) keeps working between tracks.
            </p>
            <div className="intro-hero-card-foot">
              <span className="intro-dot" aria-hidden="true" />
              Runs entirely on this device
            </div>
          </aside>
        </section>

        {/* ---------- What you can track ---------- */}
        <section className="intro-section">
          <div className="intro-section-head intro-rise">
            <h2>What you can track</h2>
            <p>Seven things the system keeps honest for you.</p>
          </div>

          <div className="intro-grid">
            {FEATURES.map((f, i) => (
              <article
                className={`intro-feature intro-rise intro-delay-${Math.min(i % 4, 3)}`}
                key={f.title}
              >
                <span className="intro-feature-icon" aria-hidden="true"><f.icon size={17} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Platform selection ---------- */}
        <section className="intro-section">
          <div className="intro-section-head intro-rise">
            <h2>Three ways in</h2>
            <p>Same tracker, same data — pick where you want to run it.</p>
          </div>

          <div className="intro-platforms">
            {CARDS.map((card, i) => {
              const here = card.id === platform;
              const Icon = card.icon;
              return (
                <article
                  className={`intro-platform${here ? ' is-here' : ''} intro-rise intro-delay-${i}`}
                  key={card.id}
                >
                  <div className="intro-platform-head">
                    <span className="intro-platform-icon" aria-hidden="true"><Icon size={20} /></span>
                    {here && <span className="intro-platform-badge">You are here</span>}
                  </div>
                  <h3>{card.title}</h3>
                  <div className="intro-platform-meta">{card.meta}</div>
                  <p>{card.blurb}</p>
                  <button
                    type="button"
                    className={`btn ${here || card.id === 'web' ? 'btn-primary' : ''} intro-platform-btn`}
                    onClick={() => cardAction(card)}
                  >
                    {buttonLabel(card)}
                  </button>
                </article>
              );
            })}
          </div>

          <p className="intro-note">
            Your data stays in this device's local storage on every platform —
            no account, no cloud, no tracking of you.
          </p>
        </section>
      </main>

      <footer className="intro-foot">
        <span>Life System — habits, rules, tracks and reflection.</span>
        <span className="intro-foot-challenge">Active track: {challenge}</span>
      </footer>

      {/* ---------- Install sheet (desktop / Android) ---------- */}
      {sheet && (
        <Modal
          title={sheet === 'desktop' ? 'Install on Desktop' : 'Install on Android'}
          onClose={() => setSheet(null)}
          wide
          footer={
            <>
              <button type="button" className="btn" onClick={() => setSheet(null)}>
                <IconArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSheet(null);
                  onEnter('web');
                }}
              >
                Continue on Web
              </button>
            </>
          }
        >
          <div className="intro-sheet">
            <p className="secondary">
              {sheet === 'desktop'
                ? `The desktop build wraps this same tracker in a standalone window for ${describeOS()}.`
                : `The Android build wraps this same tracker as a native app for ${describeOS()}.`}
            </p>

            <div className="intro-sheet-block">
              <div className="intro-sheet-label">Download</div>
              <a
                className="btn btn-primary"
                href={DOWNLOADS[sheet].href}
                onClick={() => {
                  handoffToInstalledApp(); // setup passport for the installed shell
                  setDownloaded(true);
                }}
              >
                <IconDownload size={15} /> {DOWNLOADS[sheet].label}
              </a>
              <span className="small muted">{DOWNLOADS[sheet].detail}</span>
              {downloaded && (
                <span className="small" style={{ color: 'var(--text)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <IconCheckCircle size={14} /> {DOWNLOADS[sheet].hint}
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
