import {
  computed,
  readonly,
  shallowRef,
} from 'vue';
import { formatKycThirdPartyScreen } from '@webdevelop-pro/invest-core/kyc/thirdPartyScreen';
import { useKycModel } from '../model/useKycModel.ts';
import type { KycThirdPartyStatus } from '@webdevelop-pro/invest-core/kyc/status';
import { reportError } from '@webdevelop-pro/invest-runtime/error/errorReporting';

export type { KycThirdPartyStatus } from '@webdevelop-pro/invest-core/kyc/status';

const getLinkToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('token');
};

export function useKycThirdParty() {
  const repositoryKyc = useKycModel();
  const status = shallowRef<KycThirdPartyStatus>('idle');
  const screen = computed(() => formatKycThirdPartyScreen(status.value));

  const launch = async () => {
    const linkToken = getLinkToken();
    if (!linkToken) {
      status.value = 'invalidToken';
      return;
    }

    status.value = 'launching';

    try {
      const result = await repositoryKyc.handlePlaidKycToken(linkToken);
      status.value = result?.status === 'success' ? 'success' : 'incomplete';
    } catch (error) {
      reportError(error, 'Failed to handle Plaid KYC');
      status.value = 'error';
    }
  };

  return {
    launch,
    screen,
    status: readonly(status),
  };
}
