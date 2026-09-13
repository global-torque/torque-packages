import { OfferStatuses } from '@global-torque/domain-types/offerTypes';
import {
  CANONICAL_DECIMAL_SCALE,
  canonicalDecimalToScaled,
  compareCanonicalDecimals,
} from '../decimal/canonicalDecimal.ts';

export function calculateOfferFundedPercent(
  subscribedShares: string,
  totalShares: string,
): number {
  const total = canonicalDecimalToScaled(totalShares);
  const subscribed = canonicalDecimalToScaled(subscribedShares);
  if (total === 0n) {
    return 0;
  }

  const numerator = subscribed * 100n;
  const wholePercent = numerator / total;
  const remainder = numerator % total;

  return Number(
    numerator > 85n * total || remainder === 0n
      ? wholePercent
      : wholePercent + 1n,
  );
}

export const isOfferFullyFunded = (offerFundedPercent: number): boolean => (
  offerFundedPercent >= 100
);

export const isOfferClosingSoon = (offerFundedPercent: number): boolean => (
  offerFundedPercent > 90 && !isOfferFullyFunded(offerFundedPercent)
);

export const isOfferSharesReached = (
  totalShares: string,
  subscribedShares: string,
  minInvestmentAmount: string,
  pricePerShare = '1',
): boolean => {
  if (totalShares === '0') return false;
  if (compareCanonicalDecimals(subscribedShares, totalShares) > 0) return true;
  const remainingShares = canonicalDecimalToScaled(totalShares)
    - canonicalDecimalToScaled(subscribedShares);
  const remainingAmountScaled = remainingShares * canonicalDecimalToScaled(pricePerShare);
  const minimumAmountScaled = canonicalDecimalToScaled(minInvestmentAmount)
    * (10n ** BigInt(CANONICAL_DECIMAL_SCALE));
  return remainingAmountScaled < minimumAmountScaled;
};

export const calculateOfferMinimumInvestment = (
  minInvestmentAmount: string,
  _pricePerShare?: string,
): string => minInvestmentAmount;

export function isOfferNewWithinDays(
  approvedAt?: string | Date | null,
  dayWindow = 2,
  now: Date = new Date(),
): boolean {
  if (!approvedAt) return false;

  const approvedDate = new Date(approvedAt);
  const diffMs = now.getTime() - approvedDate.getTime();
  const diffDays = diffMs / (1000 * 3600 * 24);

  return diffDays < dayWindow;
}

export function isRegD506cOffer(regType?: string | null): boolean {
  if (!regType) return false;

  const normalized = regType.toLowerCase();
  return normalized.includes('506(c)') && normalized.includes('reg d');
}

export const isOfferFundingCompleted = (status?: string | null): boolean => (
  status === OfferStatuses.legal_closed
  || status === OfferStatuses.closed_successfully
  || status === OfferStatuses.closed_unsuccessfully
);
