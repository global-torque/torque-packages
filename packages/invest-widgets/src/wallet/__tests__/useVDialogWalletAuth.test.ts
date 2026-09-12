import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { computed, ref } from 'vue';
import { useVDialogWalletAuth } from '../useVDialogWalletAuth.ts';
import {
  resetInvestWidgetProvidersForTests,
  setInvestWidgetProviders,
} from '../../providers.ts';

describe('useVDialogWalletAuth', () => {
  afterEach(() => {
    resetInvestWidgetProvidersForTests();
  });

  it('returns the mocked wallet dialog provider view model', async () => {
    const handlePrimaryClick = vi.fn();
    const open = ref(true);

    setInvestWidgetProviders({
      walletAuth: {
        useDialog: (options) => ({
          codeValue: ref('123456'),
          isBusy: computed(() => false),
          isCodeStep: computed(() => true),
          isOtpStep: computed(() => true),
          isSuccessStep: computed(() => false),
          dialogTitle: computed(() => (options.open.value ? 'Confirm Withdrawal' : 'Confirm Transaction')),
          operationIntent: computed(() => ({
            source: 'withdrawal',
            profileId: 7,
            chain: 'ethereum',
            nonce: 'request-0001',
            amount: '25',
            assetAddress: '0xasset',
            assetSymbol: 'USDC',
            destinationAddress: '0xdestination',
          })),
          operationSummaryScanBaseUrl: computed(() => 'https://scan.example'),
          stepDescription: computed(() => 'Enter the code.'),
          inputLabel: computed(() => 'Email Verification Code'),
          inputPlaceholder: computed(() => 'Enter email code'),
          inputHelperText: computed(() => 'Enter the 6-digit code we sent to your email.'),
          primaryButtonText: computed(() => 'Confirm'),
          isPrimaryDisabled: computed(() => false),
          closeDialog: vi.fn(),
          handlePrimaryClick,
        }),
      },
    });

    const viewModel = useVDialogWalletAuth({ open });

    expect(viewModel.dialogTitle.value).toBe('Confirm Withdrawal');
    expect(viewModel.operationIntent.value?.source).toBe('withdrawal');
    expect(viewModel.operationSummaryScanBaseUrl.value).toBe('https://scan.example');

    await viewModel.handlePrimaryClick();

    expect(handlePrimaryClick).toHaveBeenCalledTimes(1);
  });
});
