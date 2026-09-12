import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import { getRequiredInvestRuntimeAdapter } from '@webdevelop-pro/invest-runtime/adapters';

export function useHeaderUserState() {
  const sessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(sessionStore as any) as any;

  const profilesRepository = getRequiredInvestRuntimeAdapter('profileRepository').getStore();
  const { getUserState } = storeToRefs(profilesRepository as any) as any;

  const isUserLoading = computed(() => Boolean(getUserState.value.loading));

  return {
    userLoggedIn,
    getUserState,
    isUserLoading,
  };
}
