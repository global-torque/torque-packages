import { computed } from 'vue';
import { getRequiredInvestRuntimeAdapter } from '@webdevelop-pro/invest-runtime/adapters';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import type { ContactUsSessionPrefill } from './useContactUsForm';

export function useContactUsSessionPrefill() {
  const session = useSessionStore();
  const profiles = getRequiredInvestRuntimeAdapter('profileRepository').getStore();

  return computed<ContactUsSessionPrefill>(() => {
    const identity = session.userSession?.identity;
    if (!session.userLoggedIn || !identity) return { name: '', email: '' };
    const { traits } = identity;
    const flatName = [traits.first_name, traits.last_name].map(part => part?.trim()).filter(Boolean).join(' ');
    const sessionName = flatName || [traits.name?.first, traits.name?.last]
      .map(part => part?.trim()).filter(Boolean).join(' ');
    return {
      identityId: identity.id,
      name: profiles.getUserState.data?.fullName?.trim() || sessionName,
      email: identity.traits.email,
    };
  });
}
