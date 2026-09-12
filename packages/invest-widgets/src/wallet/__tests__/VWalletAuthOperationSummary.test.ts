import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import VWalletAuthOperationSummary from '../VWalletAuthOperationSummary.vue';

describe('VWalletAuthOperationSummary', () => {
  it('renders operation details with injected explorer links', () => {
    const wrapper = mount(VWalletAuthOperationSummary, {
      props: {
        scanBaseUrl: 'https://scan.example',
        intent: {
          source: 'withdrawal',
          profileId: 7,
          chain: 'ethereum',
          nonce: 'withdraw-request-0001',
          amount: '25',
          assetAddress: '0xasset00000000000000000001',
          assetSymbol: 'USDC',
          destinationAddress: '0xdestination0000000000000001',
        },
      },
    });

    expect(wrapper.text()).toContain('25 USDC');
    expect(wrapper.text()).toContain('Ethereum (ERC20)');
    expect(wrapper.find('a[href="https://scan.example/token/0xasset00000000000000000001"]').exists()).toBe(true);
    expect(wrapper.find('a[href="https://scan.example/address/0xdestination0000000000000001"]').exists()).toBe(true);
  });
});
