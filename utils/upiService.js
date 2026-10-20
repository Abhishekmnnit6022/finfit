// upiService.js
// Small, self-contained helper for the "scan merchant QR -> prefill -> forward
// verbatim -> confirm on return" UPI flow (Option 1).
//
// Why "verbatim forward": a genuine merchant QR already carries a verified
// merchant VPA plus, often, a signature (`sign`) and merchant category (`mc`).
// Rebuilding the URI from parsed fields and dropping those is exactly what makes
// PSP apps (GPay/PhonePe/Paytm) flag the intent as risky. So we keep the scanned
// string untouched and only append an amount/currency when the QR didn't include
// one (static QRs).

import * as Linking from 'expo-linking';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

/**
 * Parse a scanned string into its UPI parts.
 * Returns { isValid, raw, params, pa, pn, am, cu, tn, mc, tr }.
 * `isValid` is true only when the string is a upi:// link carrying a payee (pa).
 */
export function parseUpiUri(raw) {
  const str = typeof raw === 'string' ? raw.trim() : '';
  const result = { isValid: false, raw: str, params: {}, pa: '', pn: '', am: '', cu: '', tn: '', mc: '', tr: '' };

  if (!str || !str.toLowerCase().startsWith('upi://')) {
    return result;
  }

  const qIndex = str.indexOf('?');
  const query = qIndex >= 0 ? str.slice(qIndex + 1) : '';
  const params = {};

  query.split('&').forEach((pair) => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const val = eq >= 0 ? pair.slice(eq + 1) : '';
    if (!key) return;
    try {
      params[key] = decodeURIComponent(val.replace(/\+/g, ' '));
    } catch {
      params[key] = val;
    }
  });

  result.params = params;
  result.pa = params.pa || '';   // payee VPA / address
  result.pn = params.pn || '';   // payee name
  result.am = params.am || '';   // amount (present on dynamic QRs)
  result.cu = params.cu || '';   // currency
  result.tn = params.tn || '';   // transaction note
  result.mc = params.mc || '';   // merchant category code
  result.tr = params.tr || '';   // transaction reference
  result.isValid = Boolean(result.pa); // a UPI pay intent needs a payee

  return result;
}

/**
 * Build the URI to hand to the UPI app.
 * Starts from the untouched scanned string and only appends am/cu/tn when the
 * original QR did not already carry them.
 */
export function buildLaunchUri(parsed, fallbackAmount, note) {
  if (!parsed || !parsed.raw) return 'upi://pay';

  let uri = parsed.raw;
  const separator = uri.includes('?') ? '&' : '?';
  const extra = [];

  if (!parsed.am && fallbackAmount != null && String(fallbackAmount).length) {
    const clean = String(fallbackAmount).replace(/,/g, '');
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) {
      extra.push(`am=${encodeURIComponent(num.toFixed(2))}`);
    }
  }
  if (!parsed.cu) {
    extra.push('cu=INR');
  }
  if (!parsed.tn && note) {
    extra.push(`tn=${encodeURIComponent(note)}`);
  }

  if (extra.length === 0) return uri;
  return uri + separator + extra.join('&');
}

/**
 * Launch a UPI app with the given URI.
 * On Android, if a package is supplied we target it directly; otherwise (and on
 * any failure) we fall back to the system UPI chooser via Linking.
 * Returns true if a launch was attempted successfully.
 *
 * Note: there is intentionally no result/status read here. UPI apps do not
 * reliably return a status to a third-party app (Google Pay commonly returns
 * nothing even on success), so the caller confirms with the user on return.
 */
export async function launchUpiApp(uri, options = {}) {
  const { packageName } = options;

  if (Platform.OS === 'android') {
    if (packageName) {
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: uri,
          packageName,
          flags: 0x10000000,
        });
        return true;
      } catch (err) {
        console.warn('Direct package launch failed, falling back to chooser:', err?.message);
      }
    }
    await Linking.openURL(uri);
    return true;
  }

  // iOS: UPI deep-linking is best-effort only. upi:// is not reliably handled by
  // every app, so this may throw for the caller to surface.
  await Linking.openURL(uri);
  return true;
}
