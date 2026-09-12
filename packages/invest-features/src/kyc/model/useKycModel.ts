// @ts-nocheck
import { ref } from 'vue';
import { acceptHMRUpdate, defineStore } from 'pinia';
import {
  createInvestDataApiClient,
  isInvestDataDebugEnabled,
} from '@webdevelop-pro/invest-data/service/dataClientConfig';
import { createRepositoryStates, withActionState } from '../../modelState.ts';
import type {
  IKycTokenResponse,
  KycPlaidLaunchResult,
} from '@webdevelop-pro/domain-types/kycTypes';
import { loadPlaidScriptOnce, type PlaidHandler } from '@webdevelop-pro/invest-data/plaid';

// Plaid SDK types (narrow when reading; SDK does not ship types in this project)
interface IPlaidCreateConfig {
  token?: string;
  onSuccess?: (publicToken: string, metadata: unknown) => void;
  onLoad?: () => void;
  onExit?: (err: unknown, metadata: unknown) => void;
  onEvent?: (eventName: string, metadata: unknown) => void;
  receivedRedirectUri?: string | null;
}

declare global {
  interface Window {
    Plaid: {
      create: (config: IPlaidCreateConfig) => { open: () => void };
    };
  }
}

const getPlaidLinkSessionId = (metadata: unknown): string | undefined => (
  metadata && typeof metadata === 'object' && 'link_session_id' in metadata
    ? (metadata as { link_session_id?: string }).link_session_id
    : undefined
);

// eslint-disable-next-line no-console
const plaidDebugLogger = console.debug.bind(console);
// eslint-disable-next-line no-console
const plaidWarnLogger = console.warn.bind(console);

const debugPlaid = (...args: unknown[]) => {
  if (isInvestDataDebugEnabled()) {
    plaidDebugLogger(...args);
  }
};

const warnPlaid = (...args: unknown[]) => {
  if (isInvestDataDebugEnabled()) {
    plaidWarnLogger(...args);
  }
};

type KycStates = {
  tokenState: IKycTokenResponse;
};

export const useKycModel = defineStore('feature-kyc', () => {
  const apiClient = createInvestDataApiClient('plaid');

  const { tokenState, resetAll: resetActionStates } = createRepositoryStates<KycStates>({
    tokenState: undefined,
  });
  const isPlaidLoading = ref(false);
  const isPlaidDone = ref(false);

  let plaidHandler: PlaidHandler | null = null;
  let expectedLinkSessionId: string | null = null;

  // Generalized token creation
  const createToken = async (profileId: number | string) =>
    withActionState(tokenState, async () => {
      const response = await apiClient.post<IKycTokenResponse>(`/auth/kyc/${profileId}`, {});
      return response.data;
    });

  const launchPlaidLink = async (
    linkToken: string,
  ): Promise<KycPlaidLaunchResult> => {
    await loadPlaidScriptOnce();
    expectedLinkSessionId = null;

    return new Promise<KycPlaidLaunchResult>((resolve) => {
      let settled = false;

      const settle = (result: KycPlaidLaunchResult) => {
        if (settled) {
          return;
        }

        settled = true;
        isPlaidDone.value = result.status === 'success';
        resolve(result);
      };

      plaidHandler = window?.Plaid?.create({
        token: linkToken,
        onSuccess: (_publicToken: string, metadata: unknown) => {
          const linkSessionId = getPlaidLinkSessionId(metadata);

          if (expectedLinkSessionId && linkSessionId !== expectedLinkSessionId) {
            warnPlaid('[KYC Plaid] session ID mismatch', { expected: expectedLinkSessionId, received: linkSessionId });
            settle({ status: 'exit' });
            return;
          }

          settle({ status: 'success' });
        },
        onLoad: () => {
          plaidHandler?.open();
          debugPlaid('[KYC Plaid] onLoad');
        },
        onExit: (err: unknown, metadata: unknown) => {
          debugPlaid('[KYC Plaid] onExit', err, metadata);
          settle({ status: 'exit' });
        },
        onEvent: (eventName: string, metadata: unknown) => {
          const linkSessionId = getPlaidLinkSessionId(metadata);

          if (!expectedLinkSessionId && linkSessionId) {
            expectedLinkSessionId = linkSessionId;
          }

          debugPlaid('[KYC Plaid] onEvent', eventName, metadata);
        },
        receivedRedirectUri: null,
      });
    });
  };

  const runPlaidFlow = async (
    resolveLinkToken: () => Promise<string | null | undefined> | string | null | undefined,
  ): Promise<KycPlaidLaunchResult | null> => {
    isPlaidLoading.value = true;
    isPlaidDone.value = false;

    try {
      const linkToken = await resolveLinkToken();
      if (!linkToken) return null;
      return await launchPlaidLink(linkToken);
    } finally {
      isPlaidLoading.value = false;
    }
  };

  const handlePlaidKycToken = async (
    linkToken: string,
  ): Promise<KycPlaidLaunchResult | null> => runPlaidFlow(() => linkToken);

  /**
   * Generalized Plaid KYC handler — caller must pass profileId (no store fallback).
   * Returns a promise that resolves when the Plaid Link flow is closed.
   * Result `status` is `success` when Plaid completes and `exit` when the flow is closed.
   */
  const handlePlaidKyc = async (
    profileId: number | string,
  ): Promise<KycPlaidLaunchResult | null> => runPlaidFlow(async () => (
    (await createToken(profileId))?.link_token
  ));

  // Reset all state
  const resetAll = () => {
    isPlaidLoading.value = false;
    isPlaidDone.value = false;
    plaidHandler = null;
    expectedLinkSessionId = null;
    resetActionStates();
  };

  return {
    tokenState,
    isPlaidLoading,
    isPlaidDone,
    createToken,
    handlePlaidKycToken,
    handlePlaidKyc,
    resetAll,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useKycModel, import.meta.hot));
}
