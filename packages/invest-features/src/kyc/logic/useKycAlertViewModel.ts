import {
  computed, hasInjectionContext,
} from 'vue';
import { storeToRefs } from 'pinia';
import {
  useRoute,
  useRouter,
} from 'vue-router';
import { PROFILE_TYPES } from '@global-torque/domain-types/profileTypes';
import {
  createHiddenKycAlertModel,
  formatKycAlertModel,
} from '@global-torque/invest-core/kyc/kycAlert';
import { useKycModel } from '../model/useKycModel.ts';
import { InvestKycTypes } from '@global-torque/domain-types/kycTypes';
import { getInvestDataAppLinks } from '@global-torque/invest-data/service/dataClientConfig';
import { useDialogs } from '@global-torque/invest-runtime/dialogs';
import { useProfilesStore } from '@global-torque/invest-runtime/profiles';
import { useSessionStore } from '@global-torque/invest-runtime/session';

const resolveCurrentRedirectTarget = (routeFullPath?: string | null): string | undefined => {
  const normalizedRoutePath = typeof routeFullPath === 'string' ? routeFullPath.trim() : '';
  if (normalizedRoutePath) return normalizedRoutePath;
  return typeof window !== 'undefined' ? window.location.href : undefined;
};

export function useKycAlertViewModel() {
  // Supports use outside component setup (e.g. from a non-router host app);
  // onPrimaryAction falls back to window.location when router is unavailable.
  const route = hasInjectionContext()
    ? useRoute()
    : null;
  const router = hasInjectionContext()
    ? useRouter()
    : null;
  const dialogsStore = useDialogs();
  const profilesStore = useProfilesStore();
  const {
    selectedUserProfileData,
    selectedUserProfileId,
    selectedUserProfileShowKycInitForm,
    selectedUserProfileType,
    selectedUserIndividualProfile,
    isSelectedProfileLoading,
  } = storeToRefs(profilesStore as any) as any;
  const sessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(sessionStore as any) as any;
  const repositoryKyc = useKycModel();
  const { isPlaidLoading } = storeToRefs(repositoryKyc as any) as any;

  const isProfileActingAsIndividual = computed(() => (
    selectedUserProfileType.value === PROFILE_TYPES.SDIRA
    || selectedUserProfileType.value === PROFILE_TYPES.SOLO401K
  ));

  const kycProfileId = computed(() => {
    if (isProfileActingAsIndividual.value) {
      return selectedUserIndividualProfile.value?.id ?? selectedUserProfileId.value;
    }

    return selectedUserProfileId.value;
  });

  const isDataLoading = computed(() => (
    isSelectedProfileLoading.value && !selectedUserProfileData.value?.id
  ));

  const alertModel = computed(() => {
    const profile = selectedUserProfileData.value;

    if (!profile) {
      return createHiddenKycAlertModel();
    }

    return formatKycAlertModel({
      status: profile.kyc_status || InvestKycTypes.none,
      isKycApproved: profile.isKycApproved,
      isPlaidLoading: isPlaidLoading.value,
    });
  });

  const onPrimaryAction = async () => {
    const numericProfileId = Number(kycProfileId.value);
    if (!userLoggedIn.value || !selectedUserProfileId.value || !Number.isFinite(numericProfileId) || !alertModel.value.show || !alertModel.value.buttonText) {
      return;
    }

    if (selectedUserProfileShowKycInitForm.value) {
      const profileId = numericProfileId;
      const redirect = resolveCurrentRedirectTarget(route?.fullPath);

      if (!router) {
        if (typeof window === 'undefined') {
          return;
        }

        const url = new URL(getInvestDataAppLinks().profileKyc(profileId), window.location.href);
        if (redirect) {
          url.searchParams.set('redirect', redirect);
        }

        window.location.assign(url.toString());
        return;
      }

      const url = new URL(
        getInvestDataAppLinks().profileKyc(profileId),
        typeof window !== 'undefined' ? window.location.href : 'http://localhost',
      );
      Object.entries(route?.query ?? {}).forEach(([key, value]) => {
        if (typeof value === 'string') url.searchParams.set(key, value);
      });
      if (redirect) url.searchParams.set('redirect', redirect);
      await router.push(`${url.pathname}${url.search}${url.hash}`);
      return;
    }

    await repositoryKyc.handlePlaidKyc(numericProfileId);
  };

  const onDescriptionAction = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const currentTarget = event.currentTarget as HTMLElement | null;
    const contactTarget = target?.closest('[data-action="contact-us"]')
      || currentTarget?.querySelector('[data-action="contact-us"]');

    if (!contactTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dialogsStore.openContactUsDialog('dashboard verification');
  };

  return {
    alertModel,
    isDataLoading,
    onPrimaryAction,
    onDescriptionAction,
  };
}
