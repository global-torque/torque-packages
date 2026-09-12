// @ts-nocheck
import { ref } from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { useGlobalLoader } from '@webdevelop-pro/invest-runtime/loader';
import { getAuthNavigation } from '../navigation.ts';
import { resetAllData } from '@webdevelop-pro/invest-runtime/reset';
import { SELFSERVICE } from '@webdevelop-pro/domain-types/authConstants';
import { oryErrorHandling } from '@webdevelop-pro/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@webdevelop-pro/invest-runtime/error/oryResponseHandling';
import { navigateWithQueryParams } from '@webdevelop-pro/invest-runtime/navigation';

type LogoutOptions = {
  redirectTo?: string;
};

export type LogoutOutcome =
  | { status: 'navigation-started' }
  | { status: 'failed' };

export const useLogoutStore = defineStore('logout', () => {
  const authRepository = useRepositoryAuth();
  const { getAuthFlowState, getLogoutState } = storeToRefs(authRepository);

  const resetLogoutFlow = () => {
    void authRepository
      .getAuthFlow(SELFSERVICE.logout)
      .then((flow) => oryResponseHandling(flow as any));
  };

  const isLoading = ref(false);
  const token = ref('');

  // Logout handlers
  const handleLogoutSuccess = async (options: LogoutOptions = {}): Promise<void> => {
    const globalLoader = useGlobalLoader();
    globalLoader.show();
    try {
      await resetAllData();
      if (options.redirectTo) {
        navigateWithQueryParams(options.redirectTo);
        return;
      }
      await getAuthNavigation().afterLogout();
    }
    catch (error) {
      globalLoader.hide();
      throw error;
    }
  };

  const logoutHandler = async (options: LogoutOptions = {}): Promise<LogoutOutcome> => {
    token.value = '';
    isLoading.value = true;
    try {
      const flowData = await authRepository.getAuthFlow(SELFSERVICE.logout);
      oryResponseHandling(flowData);
      if (getAuthFlowState.value.error) {
        await oryErrorHandling(
          getAuthFlowState.value.error,
          'logout',
          resetLogoutFlow,
          'Failed to logout',
        );
        return { status: 'failed' };
      }
      // get logout token from flow data response
      if (getAuthFlowState.value.data) {
        token.value = getAuthFlowState.value.data.logout_token
          ? getAuthFlowState.value.data.logout_token
          : getAuthFlowState.value.data.logout_url.split('token=')[1].toString();
      }

      await authRepository.getLogout(token.value);
      if (getLogoutState.value.error) {
        await oryErrorHandling(
          getLogoutState.value.error,
          'logout',
          resetLogoutFlow,
          'Failed to logout',
        );
        return { status: 'failed' };
      }
      await handleLogoutSuccess(options);
      return { status: 'navigation-started' };
    } catch (error) {
      await oryErrorHandling(
        error as any,
        'logout',
        resetLogoutFlow,
        'Failed to logout',
      );
      return { status: 'failed' };
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    logoutHandler,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLogoutStore, import.meta.hot));
}
