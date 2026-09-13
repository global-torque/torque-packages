import {
  FundingTypes,
  InvestFundingStatuses,
  InvestmentStatuses,
} from '@global-torque/domain-types/investmentTypes';

export type InvestmentFundingClickabilityInput = {
  fundingType?: FundingTypes | string | null;
  fundingStatus?: InvestFundingStatuses | string | null;
  status?: InvestmentStatuses | string | null;
};

export const isInvestmentFundingTypeWire = (
  fundingType?: FundingTypes | string | null,
): boolean => fundingType === FundingTypes.wire;

export const isInvestmentActiveStatus = (
  status?: InvestmentStatuses | string | null,
): boolean => (
  status === InvestmentStatuses.confirmed
  || status === InvestmentStatuses.legally_confirmed
);

export const isInvestmentCompletedStatus = (
  status?: InvestmentStatuses | string | null,
): boolean => status === InvestmentStatuses.closed_successfully;

export const isInvestmentCancelledStatus = (
  status?: InvestmentStatuses | string | null,
): boolean => status === InvestmentStatuses.cancelled_after_investment;

export const isInvestmentPendingFundingStatus = (
  fundingStatus?: InvestFundingStatuses | string | null,
): boolean => (
  fundingStatus === InvestFundingStatuses.in_progress
  || fundingStatus === InvestFundingStatuses.initialize
);

export const isInvestmentFundingClickable = ({
  fundingType,
  fundingStatus,
  status,
}: InvestmentFundingClickabilityInput): boolean => {
  const isFundingTypeWire = fundingType === FundingTypes.wire;
  const isLegallyConfirmed = status === InvestmentStatuses.legally_confirmed;
  const isConfirmed = status === InvestmentStatuses.confirmed;

  if (!isFundingTypeWire && !isLegallyConfirmed) return false;
  if (isFundingTypeWire && !isLegallyConfirmed && !isConfirmed) return false;
  if (!isFundingTypeWire && fundingStatus === InvestFundingStatuses.none) return false;
  if (fundingStatus === InvestFundingStatuses.creation_error) return false;
  if (fundingStatus === InvestFundingStatuses.sent_back_pending) return false;
  if (fundingStatus === InvestFundingStatuses.sent_back_settled) return false;

  return true;
};
