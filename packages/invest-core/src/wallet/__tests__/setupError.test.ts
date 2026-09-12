import { describe, expect, it } from 'vitest';
import { isWalletSetupRequiredError } from '../setupError.ts';

describe('wallet setup error helpers', () => {
  it('treats 404 wallet lookups for approved profiles as setup required', () => {
    expect(isWalletSetupRequiredError(
      { data: { statusCode: 404 } },
      { isKycApproved: true, walletData: undefined },
    )).toBe(true);
  });

  it('treats known missing-wallet backend messages as setup required', () => {
    expect(isWalletSetupRequiredError(
      new Error('User need to create wallet'),
      { isKycApproved: true, walletData: undefined },
    )).toBe(true);
  });

  it('treats incomplete wallet registration as setup required', () => {
    expect(isWalletSetupRequiredError(
      new Error('wallet registration is incomplete for ethereum-sepolia'),
      { isKycApproved: true, walletData: undefined },
    )).toBe(true);
  });

  it('does not treat generic backend failures as setup required', () => {
    expect(isWalletSetupRequiredError(
      { data: { statusCode: 500, responseJson: { message: 'Upstream error' } } },
      { isKycApproved: true, walletData: undefined },
    )).toBe(false);
  });
});
