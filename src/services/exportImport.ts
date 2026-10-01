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
  a.download = `winter-arc-backup-${stamp}.json`;
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
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.readAsText(file);
    };
    input.click();
  });
}

export function importFromFile(jsonText: string): ImportResult {
  return importState(jsonText);
}
