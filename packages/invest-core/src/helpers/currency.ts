const defaultInstance = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const instance = (digits: number = 2) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: digits,
});

export function currency(val: number | undefined, digits?: number) {
  const formatter = digits !== undefined ? instance(digits) : defaultInstance;
  const n = Number(val);
  const safe = Number.isFinite(n) && n >= 0 ? n : 0;
  return formatter.format(safe);
}

