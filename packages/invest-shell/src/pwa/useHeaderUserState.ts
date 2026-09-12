import { computed, unref } from 'vue';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import { getRequiredInvestRuntimeAdapter } from '@webdevelop-pro/invest-runtime/adapters';

export function useHeaderUserState() {
  const session = useSessionStore();
  const userLoggedIn = computed(() => Boolean(unref(session.userLoggedIn)));
  const profileRepository = getRequiredInvestRuntimeAdapter('profileRepository').getStore();
  const isUserLoading = computed(() => Boolean(profileRepository.getUserState.loading));

  return { userLoggedIn, isUserLoading };
}
