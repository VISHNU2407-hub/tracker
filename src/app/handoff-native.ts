/* ============================================================
   Android handoff probe — first launch of the native shell.

   The web build copies a clipboard token (lifesystem-setup:<b64>)
   when the user asks to get the Android app; this probes the
   clipboard once before the first paint and imports the passport.
   Only runs on a native platform with setup NOT yet complete —
   installed relaunches never touch the clipboard.

   Kept out of passport.ts so the pure module stays Capacitor-free.
   ============================================================ */

import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { applyPassport, decodePassportToken, isSetupComplete } from './passport';

/** Look for a passport token on the clipboard and import it.
 *  Returns true when setup state changed (caller should reload). */
export async function probeClipboardToken(timeoutMs = 700): Promise<boolean> {
  try {
    if (!Capacitor.isNativePlatform()) return false;
    if (isSetupComplete()) return false;
    // Android only exposes clipboard text to the FOCUSED app — give the
    // shell a beat to come to the foreground, then race the read.
    await new Promise((r) => setTimeout(r, 150));
    const result = await Promise.race([
      Clipboard.read(),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    const text = result && typeof result.value === 'string' ? result.value : '';
    if (!text) return false;
    const passport = decodePassportToken(text);
    return passport ? applyPassport(passport) : false;
  } catch {
    return false; // no permission / no token — first-run welcome path
  }
}
