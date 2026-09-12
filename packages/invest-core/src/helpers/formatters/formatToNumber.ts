import trimEnd from 'lodash/trimEnd.js';

/**
 * when round === Infinity -> 1000.0000123 convert to 1,000.000123
 * when round === true     -> 1000.0000123 convert to 1,000.0001
 * when round === false    -> 1000.0000123 convert to 1,000
 */
export const formatToNumber = (
  number: number | `${number}`,
  round: boolean | typeof Infinity = false,
  compact = false,
) => {
  const numberString = typeof number === 'number' && number < 1e-6
    ? number.toFixed(18)
    : number.toString();
  let minimumFractionDigits = round === Infinity
    ? numberString.split('.')[1]?.length
    : round ? 2 : undefined;

  if (minimumFractionDigits) {
    minimumFractionDigits = minimumFractionDigits > 18 ? 18 : minimumFractionDigits;
  }

  const result = Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    notation: compact ? 'compact' : undefined,
  }).format(+number);

  // for round === Infinity do not convert xxx.00000266666666 -> xxx.0000026700000
  if (!compact && round === Infinity) {
    let second = numberString.split('.')[1];
    second = trimEnd(trimEnd(second, '0'), '.');
    if (!second) return result;

    return `${result.split('.')[0]}.${second}`;
  }

  return result;
};
