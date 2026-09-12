const defaultCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const createCurrencyFormatter = (digits: number = 2) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: digits,
});

export function currency(val: number | undefined, digits?: number): string {
  const formatter = digits !== undefined
    ? createCurrencyFormatter(digits)
    : defaultCurrencyFormatter;
  const n = Number(val);
  const safe = Number.isFinite(n) && n >= 0 ? n : 0;
  return formatter.format(safe);
}

export const capitalizeFirstLetter = (str: string): string => (
  str.charAt(0).toUpperCase() + str.slice(1)
);
