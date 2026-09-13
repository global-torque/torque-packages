import { describe, expect, it } from 'vitest';
import {
  FundingTypes,
  InvestFundingStatuses,
  InvestmentStatuses,
} from '@global-torque/domain-types/investmentTypes';
import {
  isInvestmentActiveStatus,
  isInvestmentCancelledStatus,
  isInvestmentCompletedStatus,
  isInvestmentFundingClickable,
  isInvestmentFundingTypeWire,
  isInvestmentPendingFundingStatus,
} from '../status.ts';

describe('investment status helpers', () => {
  it('classifies funding type and investment lifecycle statuses', () => {
    expect(isInvestmentFundingTypeWire(FundingTypes.wire)).toBe(true);
    expect(isInvestmentFundingTypeWire(FundingTypes.wallet)).toBe(false);
    expect(isInvestmentActiveStatus(InvestmentStatuses.confirmed)).toBe(true);
    expect(isInvestmentActiveStatus(InvestmentStatuses.legally_confirmed)).toBe(true);
    expect(isInvestmentCompletedStatus(InvestmentStatuses.closed_successfully)).toBe(true);
    expect(isInvestmentCancelledStatus(InvestmentStatuses.cancelled_after_investment)).toBe(true);
  });

  it('classifies pending funding statuses', () => {
    expect(isInvestmentPendingFundingStatus(InvestFundingStatuses.in_progress)).toBe(true);
    expect(isInvestmentPendingFundingStatus(InvestFundingStatuses.initialize)).toBe(true);
    expect(isInvestmentPendingFundingStatus(InvestFundingStatuses.settled)).toBe(false);
  });

  it('preserves existing funding clickability rules', () => {
    expect(isInvestmentFundingClickable({
      fundingType: FundingTypes.wire,
      fundingStatus: InvestFundingStatuses.none,
      status: InvestmentStatuses.confirmed,
    })).toBe(true);
    expect(isInvestmentFundingClickable({
      fundingType: FundingTypes.wallet,
      fundingStatus: InvestFundingStatuses.settled,
      status: InvestmentStatuses.legally_confirmed,
    })).toBe(true);
    expect(isInvestmentFundingClickable({
      fundingType: FundingTypes.wallet,
      fundingStatus: InvestFundingStatuses.none,
      status: InvestmentStatuses.legally_confirmed,
    })).toBe(false);
    expect(isInvestmentFundingClickable({
      fundingType: FundingTypes.ach,
      fundingStatus: InvestFundingStatuses.settled,
      status: InvestmentStatuses.confirmed,
    })).toBe(false);
    expect(isInvestmentFundingClickable({
      fundingType: FundingTypes.wire,
      fundingStatus: InvestFundingStatuses.creation_error,
      status: InvestmentStatuses.confirmed,
    })).toBe(false);
  });
});
