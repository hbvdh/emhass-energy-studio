// Predbat reports its financial metrics in cents ("c") on EUR installations.
// Render the same euro notation as the Energy Studio dashboard, with two decimals.
const CENT_UNITS = new Set(['c', 'ct', '¢', 'cent', 'cents', 'eurocent', 'eurocents', '€ct']);
const EURO_UNITS = new Set(['€', 'eur', 'euro', 'euros']);
const euroAmount = value => `${value < 0 ? '-€ ' : '€ '}${Math.abs(value).toLocaleString('nl-NL', {minimumFractionDigits:2,maximumFractionDigits:2})}`;

export function formatEuroMetric(value, unit) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const u=String(unit||'').trim().toLowerCase();
  if (CENT_UNITS.has(u)) return euroAmount(value/100);
  if (EURO_UNITS.has(u)) return euroAmount(value);
  // Never silently interpret British pence or unknown units as EUR.
  return null;
}
