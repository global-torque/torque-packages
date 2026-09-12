import { describe, expect, it } from 'vitest';
import {
  buildChainExplorerAddressUrl,
  buildChainExplorerTransactionUrl,
  buildWalletAuthExplorerLink,
  formatWalletAuthAddressValue,
  formatWalletAuthAssetValue,
  getWalletAuthExchangeTargetAssetAddress,
  shortenWalletAuthOperationText,
} from '../operationPresentation.ts';

describe('wallet operation presentation helpers', () => {
  it('builds transaction links from the deployment chain without a network default', () => {
    expect(buildChainExplorerTransactionUrl('base', '0xabc'))
      .toBe('https://basescan.org/tx/0xabc');
    expect(buildChainExplorerTransactionUrl('Ethereum Sepolia', '0xdef'))
      .toBe('https://sepolia.etherscan.io/tx/0xdef');
    expect(buildChainExplorerTransactionUrl('unsupported', '0xdef')).toBeNull();
  });

  it('builds Vault address links only for mapped chains and valid addresses', () => {
    const address = '0x1111111111111111111111111111111111111111';
    expect(buildChainExplorerAddressUrl('base', address))
      .toBe(`https://basescan.org/address/${address}`);
    expect(buildChainExplorerAddressUrl('ethereum-sepolia', address))
      .toBe(`https://sepolia.etherscan.io/address/${address}`);
    expect(buildChainExplorerAddressUrl('unsupported', address)).toBeNull();
    expect(buildChainExplorerAddressUrl('base', 'not-an-address')).toBeNull();
    expect(buildChainExplorerAddressUrl('base', '')).toBeNull();
  });

  it('shortens long wallet operation text while leaving short text unchanged', () => {
    expect(shortenWalletAuthOperationText(' 0x1234 ')).toBe('0x1234');
    expect(shortenWalletAuthOperationText('0x1234567890abcdef1234567890abcdef12345678'))
      .toBe('0x123456...345678');
  });

  it('formats addresses and asset labels for operation summaries', () => {
    expect(formatWalletAuthAddressValue('0x1234567890abcdef')).toBe('0x1234567890abcdef');
    expect(formatWalletAuthAddressValue('0x1234567890abcdef1234567890abcdef12345678'))
      .toBe('0x123456...345678');
    expect(formatWalletAuthAssetValue('USDC', '0x1234567890abcdef1234567890abcdef12345678'))
      .toBe('USDC (0x123456...345678)');
    expect(formatWalletAuthAssetValue('', '0x1234567890abcdef1234567890abcdef12345678'))
      .toBe('0x123456...345678');
  });

  it('builds explorer links only when value and base URL are available', () => {
    expect(buildWalletAuthExplorerLink({
      baseUrl: 'https://scan.example.test/',
      type: 'address',
      value: '0xabc',
      text: '0xabc',
      ariaLabel: 'View wallet',
    })).toEqual({
      href: 'https://scan.example.test/address/0xabc',
      text: '0xabc',
      title: '0xabc',
      ariaLabel: 'View wallet',
    });
    expect(buildWalletAuthExplorerLink({
      baseUrl: '',
      type: 'address',
      value: '0xabc',
      text: '0xabc',
      ariaLabel: 'View wallet',
    })).toBeNull();
  });

  it('returns target asset addresses only for exchange intents', () => {
    expect(getWalletAuthExchangeTargetAssetAddress({
      source: 'exchange',
      profileId: 1,
      chain: 'sepolia',
      nonce: '1',
      amount: '1',
      assetAddress: '0xusdc',
      assetSymbol: 'USDC',
      toAssetAddress: '0xtarget',
      toAssetSymbol: 'RWA',
      destinationAddress: '0xdestination',
    })).toBe('0xtarget');
    expect(getWalletAuthExchangeTargetAssetAddress({
      source: 'withdrawal',
      profileId: 1,
      chain: 'sepolia',
      nonce: '1',
      amount: '1',
      assetAddress: '0xusdc',
      assetSymbol: 'USDC',
      destinationAddress: '0xdestination',
    })).toBe('');
  });
});
