/** 18 → "18°", -2 → "−2°" (true minus sign). Strings pass through untouched. */
export function formatTemp(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '';
  const n = Math.round(value);
  // Math.round(-0.4) is -0; show it as 0.
  if (n === 0) return '0°';
  return (n < 0 ? `−${Math.abs(n)}` : String(n)) + '°';
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
