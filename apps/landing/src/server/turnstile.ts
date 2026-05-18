export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env['TURNSTILE_SECRET_KEY'];
  if (!secret) {
    console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification');
    return true;
  }

  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });
    const json = await resp.json() as { success: boolean };
    return json.success === true;
  } catch (err) {
    console.error('[turnstile] Verification request failed:', err);
    return false;
  }
}
