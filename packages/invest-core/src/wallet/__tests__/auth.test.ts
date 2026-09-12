import { describe, expect, it } from 'vitest';
import {
  deriveWalletAuthEmail,
  getWalletAuthAddressFromDetails,
  isRecoverableWalletAuthError,
  isWalletBackendError,
  isWalletBackendReady,
  isUserRejectedWalletSignatureError,
  normalizeWalletAuthOperationIntent,
  resolveWalletAuthErrorMessage,
  shouldPromptWalletAuth,
} from '../auth.ts';

describe('wallet auth helpers', () => {
  it('uses the real email for individual profiles', () => {
    expect(deriveWalletAuthEmail('User@Mail.com', 'Acme Holdings LLC', true)).toBe('user@mail.com');
  });

  it('derives a deterministic alias for non-individual profiles', () => {
    expect(deriveWalletAuthEmail('user@mail.com', ' Acme Holdings, LLC ', false)).toBe(
      'user+acme-holdings-llc@mail.com',
    );
  });

  it('treats created and verified statuses as backend-ready', () => {
    expect(isWalletBackendReady('created')).toBe(true);
    expect(isWalletBackendReady('verified')).toBe(true);
    expect(isWalletBackendReady('error')).toBe(false);
  });

  it('recognizes explicit backend error statuses', () => {
    expect(isWalletBackendError('error')).toBe(true);
    expect(isWalletBackendError('error_retry')).toBe(true);
    expect(isWalletBackendError('verified')).toBe(false);
  });

  it('prompts wallet auth only when KYC is approved and wallet is not ready', () => {
    expect(shouldPromptWalletAuth({ isKycApproved: true, walletStatus: '' })).toBe(true);
    expect(shouldPromptWalletAuth({ isKycApproved: true, walletStatus: 'verified' })).toBe(false);
    expect(shouldPromptWalletAuth({ isKycApproved: true, walletStatus: 'error' })).toBe(false);
    expect(shouldPromptWalletAuth({ isKycApproved: false, walletStatus: '' })).toBe(false);
  });

  it('extracts a normalized wallet address from signer auth details', () => {
    expect(getWalletAuthAddressFromDetails({ address: ' 0xabc123 ' })).toBe('0xabc123');
    expect(getWalletAuthAddressFromDetails({ address: '' })).toBe('');
    expect(getWalletAuthAddressFromDetails(null)).toBe('');
  });

  it('normalizes wallet operation intent text without changing the operation shape', () => {
    expect(normalizeWalletAuthOperationIntent({
      source: 'exchange',
      profileId: 7,
      chain: ' sepolia ',
      nonce: ' auth_1 ',
      amount: ' 25.00 ',
      assetAddress: ' 0xusdc ',
      assetSymbol: ' USDC ',
      toAssetAddress: ' 0xeth ',
      toAssetSymbol: ' ETH ',
      destinationAddress: ' 0xrecipient ',
      estimatedReceiveText: ' 0.01 ETH ',
      estimatedRateText: ' ',
    })).toEqual({
      source: 'exchange',
      profileId: 7,
      chain: 'sepolia',
      nonce: 'auth_1',
      amount: '25.00',
      assetAddress: '0xusdc',
      assetSymbol: 'USDC',
      toAssetAddress: '0xeth',
      toAssetSymbol: 'ETH',
      destinationAddress: '0xrecipient',
      estimatedReceiveText: '0.01 ETH',
    });
  });

  it('classifies signer-auth errors as recoverable wallet-auth failures', () => {
    expect(isRecoverableWalletAuthError(new Error('Wallet signer is not connected.'))).toBe(true);
    expect(isRecoverableWalletAuthError(new Error('Iframe container cannot be found'))).toBe(true);
    expect(isRecoverableWalletAuthError({
      name: 'NotAuthenticatedError',
      message: 'Signer not authenticated. Please authenticate to use this signer',
    })).toBe(true);
    expect(isRecoverableWalletAuthError(
      new Error('Failed to sign: Key not initialized. Call init() first. Version: viem@2.54.1'),
    )).toBe(true);
    expect(isRecoverableWalletAuthError(new Error('User rejected signature'))).toBe(false);
  });

  it('detects explicit user-rejected signing errors', () => {
    expect(isUserRejectedWalletSignatureError(new Error('User rejected the request.'))).toBe(true);
    expect(isUserRejectedWalletSignatureError(new Error('Request rejected by backend.'))).toBe(false);
  });

  it('extracts the nested SDK message from structured wallet-auth errors', () => {
    expect(resolveWalletAuthErrorMessage({
      error: '{"code":3,"message":"Max number of OTPs have been initiated please wait and try again","details":[{"@type":"type.googleapis.com/errors.v1.TurnkeyErrorDetail","turnkeyErrorCode":"MAX_OTP_INITIATED"}],"turnkeyErrorCode":"MAX_OTP_INITIATED"}',
    }, 'Fallback')).toBe('Max number of OTPs have been initiated please wait and try again');
  });
});
