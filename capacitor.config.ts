import type { CapacitorConfig } from '@capacitor/cli';

/* ============================================================
   Life System — Android shell (Capacitor).
   The exact same built web app (dist/) runs inside the native
   WebView; data still lives in the device's local storage.
   ============================================================ */

const config: CapacitorConfig = {
  appId: 'com.lifesystem.app',
  appName: 'Life System',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
