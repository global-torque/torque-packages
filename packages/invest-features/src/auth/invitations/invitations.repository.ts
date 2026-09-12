import { acceptHMRUpdate, defineStore } from 'pinia';
import type { SignupProfileType } from '@webdevelop-pro/domain-types/onboardingTypes';
import { useInvestApplicationContext } from '@webdevelop-pro/invest-runtime/application-context';
import {
  createRepositoryStates,
  withActionState,
} from '../../modelState.ts';
import {
  normalizeUserInvitationAcceptance,
  normalizeUserInvitationPreview,
} from './invitations.formatter.ts';
import type {
  UserInvitationAcceptance,
  UserInvitationPreview,
} from './invitations.types.ts';

type InvitationStates = {
  previewState: UserInvitationPreview;
  acceptState: UserInvitationAcceptance;
};

export const useRepositoryInvitations = defineStore('repository-invitations', () => {
  const invitations = useInvestApplicationContext().createInvitationsSdkResource();
  const {
    previewState,
    acceptState,
    resetAll,
  } = createRepositoryStates<InvitationStates>({
    previewState: undefined,
    acceptState: undefined,
  });

  const preview = (
    code: string,
    signal?: AbortSignal,
  ): Promise<UserInvitationPreview> => withActionState(previewState, async () => {
    const response = await invitations.preview({
      body: { code },
      request: {
        signal,
        cache: 'no-store',
        retry: { maxRetries: 0 },
      },
    });
    return normalizeUserInvitationPreview(response.data);
  });

  const accept = (
    code: string,
    selectedProfileType?: SignupProfileType,
  ): Promise<UserInvitationAcceptance> => withActionState(acceptState, async () => {
    const response = await invitations.accept({
      body: {
        code,
        ...(selectedProfileType ? { selectedProfileType } : {}),
      },
      request: {
        cache: 'no-store',
        retry: { maxRetries: 0 },
      },
    });
    return normalizeUserInvitationAcceptance(response.data);
  });

  return {
    previewState,
    acceptState,
    preview,
    accept,
    resetAll,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRepositoryInvitations, import.meta.hot));
}
