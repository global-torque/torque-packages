export const CANONICAL_DECIMAL_PATTERN = /^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{0,17}[1-9])?$/u;

export const CANONICAL_DECIMAL_SCALE = 18;
export const MAX_CANONICAL_DECIMAL = '99999999999999999999.999999999999999999';
const SCALE_FACTOR = 10n ** BigInt(CANONICAL_DECIMAL_SCALE);
const EXACT_DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u;

export function isCanonicalDecimalString(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_DECIMAL_PATTERN.test(value);
}

export function assertCanonicalDecimalString(
  value: unknown,
  fieldName = 'decimal value',
): asserts value is string {
  if (!isCanonicalDecimalString(value)) {
    throw new TypeError(`${fieldName} must be a canonical decimal string`);
  }
}

export function assertPositiveCanonicalDecimalString(
  value: unknown,
  fieldName = 'decimal value',
): asserts value is string {
  assertCanonicalDecimalString(value, fieldName);
  if (value === '0') {
    throw new RangeError(`${fieldName} must be greater than zero`);
  }
}

export function canonicalDecimalToScaled(value: string): bigint {
  assertCanonicalDecimalString(value);
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE_FACTOR
    + BigInt(fraction.padEnd(CANONICAL_DECIMAL_SCALE, '0') || '0');
}

export function scaledToCanonicalDecimal(value: bigint): string {
  if (value < 0n) {
    throw new RangeError('canonical decimal values cannot be negative');
  }

  const whole = value / SCALE_FACTOR;
  const fraction = (value % SCALE_FACTOR)
    .toString()
    .padStart(CANONICAL_DECIMAL_SCALE, '0')
    .replace(/0+$/u, '');
  const result = fraction ? `${whole}.${fraction}` : whole.toString();
  assertCanonicalDecimalString(result);
  return result;
}

export function compareCanonicalDecimals(left: string, right: string): number {
  const leftScaled = canonicalDecimalToScaled(left);
  const rightScaled = canonicalDecimalToScaled(right);
  if (leftScaled === rightScaled) return 0;
  return leftScaled < rightScaled ? -1 : 1;
}

export function multiplyCanonicalDecimals(left: string, right: string): string {
  const product = canonicalDecimalToScaled(left) * canonicalDecimalToScaled(right);
  const productScale = CANONICAL_DECIMAL_SCALE * 2;
  const factor = 10n ** BigInt(productScale);
  const whole = product / factor;
  const fraction = (product % factor)
    .toString()
    .padStart(productScale, '0')
    .replace(/0+$/u, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

type CanonicalDecimalFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
};

export function formatCanonicalDecimal(
  value: string,
  options: CanonicalDecimalFormatOptions = {},
): string {
  let scaled = canonicalDecimalToScaled(value);
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options.maximumFractionDigits ?? CANONICAL_DECIMAL_SCALE;

  if (
    !Number.isSafeInteger(minimumFractionDigits)
    || !Number.isSafeInteger(maximumFractionDigits)
    || minimumFractionDigits < 0
    || maximumFractionDigits > CANONICAL_DECIMAL_SCALE
    || minimumFractionDigits > maximumFractionDigits
  ) {
    throw new RangeError('invalid canonical decimal formatting precision');
  }

  const discardedDigits = CANONICAL_DECIMAL_SCALE - maximumFractionDigits;
  if (discardedDigits > 0) {
    const divisor = 10n ** BigInt(discardedDigits);
    const quotient = scaled / divisor;
    const remainder = scaled % divisor;
    scaled = (quotient + (remainder * 2n >= divisor ? 1n : 0n)) * divisor;
  }

  const whole = scaled / SCALE_FACTOR;
  const groupedWhole = options.useGrouping === false
    ? whole.toString()
    : whole.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  let fraction = (scaled % SCALE_FACTOR)
    .toString()
    .padStart(CANONICAL_DECIMAL_SCALE, '0')
    .slice(0, maximumFractionDigits);

  while (fraction.length > minimumFractionDigits && fraction.endsWith('0')) {
    fraction = fraction.slice(0, -1);
  }

  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole;
}

export function formatCanonicalUsd(value: string, fractionDigits = 2): string {
  return `$${formatCanonicalDecimal(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Format a nonnegative exact decimal (including a scale-36 product) with one rounding step. */
export function formatExactUsd(value: string, fractionDigits = 2): string {
  if (!EXACT_DECIMAL_PATTERN.test(value)) {
    throw new TypeError('exact decimal value must be a nonnegative canonical decimal string');
  }
  if (!Number.isSafeInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 36) {
    throw new RangeError('invalid exact decimal formatting precision');
  }

  const [wholePart, fractionPart = ''] = value.split('.');
  let unscaled = BigInt(`${wholePart}${fractionPart}`);
  if (fractionPart.length > fractionDigits) {
    const divisor = 10n ** BigInt(fractionPart.length - fractionDigits);
    const quotient = unscaled / divisor;
    const remainder = unscaled % divisor;
    unscaled = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  }
  else if (fractionPart.length < fractionDigits) {
    unscaled *= 10n ** BigInt(fractionDigits - fractionPart.length);
  }

  const factor = 10n ** BigInt(fractionDigits);
  const whole = fractionDigits === 0 ? unscaled : unscaled / factor;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  if (fractionDigits === 0) return `$${grouped}`;
  const fraction = (unscaled % factor).toString().padStart(fractionDigits, '0');
  return `$${grouped}.${fraction}`;
}
