import { describe, expect, it } from 'vitest';
import { InvestKycTypes } from '@global-torque/domain-types/kycTypes';
import { formatKycAlertModel } from '@global-torque/invest-core/kyc/kycAlert';

describe('formatKycAlertModel', () => {
  it.each([
    [InvestKycTypes.none, true, 'error', 'Verify Identity', 'Verify Identity'],
    [InvestKycTypes.new, true, 'error', 'Verify Identity', 'Verify Identity'],
    [InvestKycTypes.pending, true, 'error', 'Finish Your KYC', 'Continue'],
    [InvestKycTypes.in_progress, true, 'info', 'Verification In Progress', undefined],
    [InvestKycTypes.declined, true, 'error', 'Verification Declined', undefined],
  ])('maps %s into the normalized alert model', (status, show, variant, title, buttonText) => {
    const model = formatKycAlertModel({ status });

    expect(model.show).toBe(show);
    expect(model.variant).toBe(variant);
    expect(model.title).toBe(title);
    expect(model.buttonText).toBe(buttonText);
  });

  it('hides the alert for approved KYC status', () => {
    const model = formatKycAlertModel({ status: InvestKycTypes.approved });

    expect(model.show).toBe(false);
    expect(model.title).toBe('');
    expect(model.buttonText).toBeUndefined();
  });

  it('hides the alert when the profile is already approved even if the status is stale', () => {
    const model = formatKycAlertModel({
      status: InvestKycTypes.pending,
      isKycApproved: true,
    });

    expect(model.show).toBe(false);
  });

  it('mirrors Plaid loading into CTA loading and disabled state', () => {
    const model = formatKycAlertModel({
      status: InvestKycTypes.pending,
      isPlaidLoading: true,
    });

    expect(model.isLoading).toBe(true);
    expect(model.isDisabled).toBe(true);
  });
});
