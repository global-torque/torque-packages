const RAW_AMOUNT = /^(?:0|[1-9]\d*)$/u;
const DECIMAL_AMOUNT = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/u;

export const normalizeRawAmount = (value: string): string | null => {
  const normalized = value.trim();
  if (!RAW_AMOUNT.test(normalized)) return null;
  return BigInt(normalized).toString();
};

export const decimalAmountToRaw = (
  value: string,
  decimals: number,
): string | null => {
  if (!Number.isSafeInteger(decimals) || decimals < 0) return null;
  const normalized = value.trim();
  const match = DECIMAL_AMOUNT.exec(normalized);
  if (!match) return null;

  const fractional = match[1] ?? '';
  if (fractional.length > decimals) return null;

  const whole = normalized.split('.')[0] ?? '0';
  const paddedFractional = fractional.padEnd(decimals, '0');
  return normalizeRawAmount(`${whole}${paddedFractional}`.replace(/^0+(?=\d)/u, ''));
};

export const compareRawAmounts = (left: string, right: string): number | null => {
  const normalizedLeft = normalizeRawAmount(left);
  const normalizedRight = normalizeRawAmount(right);
  if (normalizedLeft === null || normalizedRight === null) return null;

  const leftValue = BigInt(normalizedLeft);
  const rightValue = BigInt(normalizedRight);
  if (leftValue === rightValue) return 0;
  return leftValue < rightValue ? -1 : 1;
};

export const formatRawAmount = (
  value: string,
  decimals: number,
  options: {
    maximumFractionDigits?: number;
    trimTrailingZeros?: boolean;
  } = {},
): string => {
  const normalized = normalizeRawAmount(value);
  if (normalized === null || !Number.isSafeInteger(decimals) || decimals < 0) {
    return '';
  }

  const padded = normalized.padStart(decimals + 1, '0');
  const whole = decimals === 0 ? padded : padded.slice(0, -decimals);
  let fractional = decimals === 0 ? '' : padded.slice(-decimals);
  const maximumFractionDigits = options.maximumFractionDigits ?? decimals;
  if (Number.isSafeInteger(maximumFractionDigits) && maximumFractionDigits >= 0) {
    fractional = fractional.slice(0, maximumFractionDigits);
  }
  if (options.trimTrailingZeros !== false) {
    fractional = fractional.replace(/0+$/u, '');
  }
  return fractional ? `${whole}.${fractional}` : whole;
};

export const formatSignedRawAmount = (
  value: string,
  decimals: number,
  options: {
    maximumFractionDigits?: number;
    trimTrailingZeros?: boolean;
  } = {},
): string => {
  const normalized = value.trim();
  const negative = normalized.startsWith('-');
  const formatted = formatRawAmount(
    negative ? normalized.slice(1) : normalized,
    decimals,
    options,
  );
  if (!formatted) return '';
  return negative && formatted !== '0' ? `-${formatted}` : formatted;
};
