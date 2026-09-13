import { computed, unref } from 'vue';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { getRequiredInvestRuntimeAdapter } from '@global-torque/invest-runtime/adapters';

export function useHeaderUserState() {
  const session = useSessionStore();
  const userLoggedIn = computed(() => Boolean(unref(session.userLoggedIn)));
  const profileRepository = getRequiredInvestRuntimeAdapter('profileRepository').getStore();
  const isUserLoading = computed(() => Boolean(profileRepository.getUserState.loading));

  return { userLoggedIn, isUserLoading };
}
