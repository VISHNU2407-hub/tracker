import React, { useRef, useState } from 'react';
import type { AppDataApi } from '../hooks/useAppData';
import { PageHeader } from '../app/layout/PageHeader';
import { ConfirmModal } from '../components/ui/Modal';
import { downloadBackup, pickBackupFile, importFromFile } from '../services/exportImport';
import { IconDownload, IconUpload, IconAlert } from '../components/icons';
import type { AppData } from '../types';

/* ============================================================
   Settings page (spec §5 persistence requirements):
   export JSON, validate-and-import, reset all data.
   ============================================================ */

export function SettingsPage({ api }: { api: AppDataApi }) {
  const { data } = api;
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmImport, setConfirmImport] = useState<AppData | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadBackup(data);
  };

  const onPickFile = async () => {
    try {
      const text = await pickBackupFile();
      const result = importFromFile(text);
      if (!result.ok || !result.data) {
        setImportMsg({ ok: false, text: result.error ?? 'Import failed.' });
        return;
      }
      // Show a summary before replacing state (spec: validate before replacing).
      setConfirmImport(result.data);
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : 'Import failed.' });
    }
  }

  const applyImport = (imported: AppData) => {
    api.replaceAllData(imported);
    setImportMsg({
      ok: true,
      text: `Backup restored: Arc from ${imported.arc?.startDate ?? '?'} · ${imported.habits.length} habits · ${Object.keys(imported.dailyRecords).length} recorded days.`,
    });
  };

  return (
    <div>
      <PageHeader title="Settings" sub="Backup, restore and reset your local data. No account, no cloud." />

      <div className="stack" style={{ maxWidth: 640 }}>
        {/* Data management */}
        <div className="card">
          <div className="card-title">Data management</div>
          <p className="secondary small" style={{ marginBottom: 14 }}>
            All data lives in this browser's localStorage. Export regularly — clearing browser data will erase your Arc.
          </p>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={handleExport}>
              <IconDownload size={15} /> Export backup (JSON)
            </button>
            <button type="button" className="btn" onClick={onPickFile}>
              <IconUpload size={15} /> Import backup
            </button>
          </div>

          {importMsg && (
            <div
              role="status"
              className="small"
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 9,
                border: `1px solid ${importMsg.ok ? 'var(--success-border)' : 'var(--danger-border)'}`,
                background: importMsg.ok ? 'var(--success-dim)' : 'var(--danger-dim)',
                color: importMsg.ok ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {importMsg.text}
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <div className="kv-row"><span className="kv-key">Schema version</span><span className="kv-val">{data.version}</span></div>
            <div className="kv-row"><span className="kv-key">Habits stored</span><span className="kv-val">{data.habits.length}</span></div>
            <div className="kv-row"><span className="kv-key">Recorded days</span><span className="kv-val">{Object.keys(data.dailyRecords).length}</span></div>
            <div className="kv-row"><span className="kv-key">Reflections</span><span className="kv-val">{Object.keys(data.reflections).length}</span></div>
          </div>
        </div>

        {/* Demo mode (spec §12: optional demo data only) */}
        <div className="card">
          <div className="card-title">Demo mode</div>
          <label className="row-between" htmlFor="demo-toggle" style={{ cursor: 'pointer' }}>
            <span>
              <span style={{ fontWeight: 600 }}>Show sample data</span>
              <span className="secondary small" style={{ display: 'block', marginTop: 2 }}>
                Preview the dashboard with example data. Your real data is never modified. Off = normal mode, always driven by your stored data.
              </span>
            </span>
            <span className="switch">
              <input id="demo-toggle" type="checkbox" checked={data.settings.demoMode} onChange={(e) => api.setDemoMode(e.target.checked)} />
              <span className="switch-track" />
            </span>
          </label>
          {data.settings.demoMode && (
            <div className="card" style={{ marginTop: 14, background: 'var(--bg-raised)', boxShadow: 'none' }}>
              <p className="small secondary">
                <IconAlert size={13} style={{ verticalAlign: '-2px' }} /> Demo data is read-only preview of what a mid-Arc dashboard looks like. Toggle off to return to your real data.
              </p>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="danger-zone">
          <div className="card-title" style={{ color: 'var(--danger)' }}>Danger zone</div>
          <p className="secondary small" style={{ marginBottom: 14 }}>
            Permanently erases the Arc, habits, daily records and reflections from this browser. Export a backup first if you might want it back.
          </p>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>
            <IconAlert size={15} /> Reset All Data
          </button>
        </div>
      </div>

      {/* Import preview confirmation */}
      {confirmImport && (
        <ConfirmModal
          title="Restore this backup?"
          message={
            <>
              <p>This <strong>replaces all current data</strong> with the backup:</p>
              <div style={{ marginTop: 8 }}>
                <div className="kv-row"><span className="kv-key">Arc start</span><span className="kv-val">{confirmImport.arc?.startDate ?? '—'}</span></div>
                <div className="kv-row"><span className="kv-key">Goal</span><span className="kv-val">{confirmImport.arc?.goal || '—'}</span></div>
                <div className="kv-row"><span className="kv-key">Habits</span><span className="kv-val">{confirmImport.habits.length}</span></div>
                <div className="kv-row"><span className="kv-key">Recorded days</span><span className="kv-val">{Object.keys(confirmImport.dailyRecords).length}</span></div>
                <div className="kv-row"><span className="kv-key">Reflections</span><span className="kv-val">{Object.keys(confirmImport.reflections).length}</span></div>
              </div>
            </>
          }
          confirmLabel="Replace my data"
          danger
          onConfirm={() => { applyImport(confirmImport); setConfirmImport(null); }}
          onClose={() => setConfirmImport(null)}
        />
      )}

      {/* Reset confirmation — strong confirmation per spec §5 */}
      {confirmReset && (
        <ConfirmModal
          title="Reset ALL data?"
          danger
          requireText="RESET"
          message="This permanently deletes your Arc, habits, all daily records and reflections from this browser. This cannot be undone."
          confirmLabel="Erase everything"
          onConfirm={() => {
            api.wipeEverything();
            setImportMsg(null);
          }}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
