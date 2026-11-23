// Shared client for /api/auth-otp: password reset by emailed OTP code and
// server-mediated admin sign-in with the per-email attempt locks. The server
// holds every counter, so these calls only report what it answers.
export type OtpResult = { status: number; body: any };

export async function otpCall(op: string, payload: Record<string, unknown>): Promise<OtpResult> {
  try {
    const res = await fetch('/api/auth-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, ...payload }),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch {
    return { status: 0, body: {} };
  }
}

/** A one-hour lock's wall-clock end, as the reader's own time. */
export function lockTimeString(retryAt: number | undefined): string {
  if (!retryAt || !isFinite(retryAt)) return 'in 1 hour';
  const d = new Date(retryAt);
  const mins = Math.max(1, Math.ceil((retryAt - Date.now()) / 60000));
  const at = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return mins > 90 ? `at ${at}` : `until about ${at}`;
}

export const NEW_PASSWORD_MIN = 6;
export const newPasswordOk = (p: string) => p.length >= NEW_PASSWORD_MIN;
export const NEW_PASSWORD_HINT = 'At least 6 characters.';

/** Seconds until a wall-clock lock ends (0 once it has passed or is absent). */
export const secUntil = (at: number | undefined) => Math.max(0, Math.ceil((((at || 0) as number) - Date.now()) / 1000));
/** m:ss for the lock and resend countdowns. */
export const mmssOf = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
