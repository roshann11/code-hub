/** Require E.164: + followed by country code and number (no spaces). */
export function normalizeE164(phone) {
  const raw = String(phone ?? '').trim().replace(/\s/g, '');
  if (!raw.startsWith('+')) return null;
  const digits = raw.slice(1).replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (!/^[1-9]/.test(digits)) return null;
  return `+${digits}`;
}
