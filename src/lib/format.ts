export function splitLap(t: number | null | undefined): [string, string] {
  if (t === null || t === undefined || !Number.isFinite(t) || t < 0) return ['0:00', '.000'];
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  const whole = Math.floor(s);
  const ms = Math.floor((s - whole) * 1000);
  return [`${m}:${String(whole).padStart(2, '0')}`, `.${String(ms).padStart(3, '0')}`];
}

export function signed(n: number | null | undefined, digits = 3) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}`;
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
