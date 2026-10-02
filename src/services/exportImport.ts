/* ============================================================
   Export/import helpers — file download and file picking.
   Validation itself lives in the storage service.
   ============================================================ */

import { exportState, importState, type ImportResult } from './storage';
import type { AppData } from '../types';

export function downloadBackup(data: AppData): void {
  const json = exportState(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `life-system-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function pickBackupFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    // Settle on every exit path: a cancelled dialog must not hang forever.
    const done = (fn: () => void) => { input.onchange = null; input.oncancel = null; fn(); };
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        done(() => reject(new Error('No file selected.')));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => done(() => resolve(String(reader.result ?? '')));
      reader.onerror = () => done(() => reject(new Error('Could not read the file.')));
      reader.readAsText(file);
    };
    input.oncancel = () => done(() => reject(new Error('Import cancelled.')));
    input.click();
  });
}

export function importFromFile(jsonText: string): ImportResult {
  return importState(jsonText);
}
