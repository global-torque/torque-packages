import { useInvestApplicationContext } from '../../applicationContext.ts';
import {
  computed, ref, toRef, watch,
} from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { cookiesOptions } from '../../session/store/useSession.ts';
import { useCookies } from '@vueuse/integrations/useCookies';
import { useSessionStore } from '../../session/store/useSession.ts';
import { PROFILE_TYPES } from '@global-torque/domain-types';
import { resetAllProfileData } from '../../resetAllData.ts';
import { reportOfflineReadError } from '../../error/errorReporting.ts';
import { shouldPreserveOfflineSession } from '../../session/offlineSession.ts';
import { requestLogout } from '../../lifecycle/domainLifecycle.ts';
import { getRequiredInvestRuntimeAdapter } from '../../adapters.ts';
import type { INotification } from '@global-torque/domain-types/notificationsTypes';

type InitProfilesOptions = {
  force?: boolean;
};

const getUpdatedAtTimestamp = (profile: unknown): number => {
  if (typeof profile !== 'object' || profile === null || !('updated_at' in profile)
    || typeof profile.updated_at !== 'string') {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(profile.updated_at);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

const sortProfilesByUpdatedAt = <T>(profiles: readonly T[]): T[] => (
  profiles
    .map((profile, index) => ({
      profile,
      index,
      updatedAt: getUpdatedAtTimestamp(profile),
    }))
    .sort((left, right) => {
      if (left.updatedAt === right.updatedAt) {
        return left.index - right.index;
      }

      return right.updatedAt - left.updatedAt;
    })
    .map(({ profile }) => profile)
);

export const useProfilesStore = defineStore('profiles', () => {
  const isStaticSite = Boolean(useInvestApplicationContext().appConfig.isStaticSite);
  const route = isStaticSite ? null : useRoute();

  const userSessionStore = useSessionStore();
  const { userSession, userLoggedIn } = storeToRefs(userSessionStore);
  const cookies = useCookies();

  const useRepositoryProfilesStore = getRequiredInvestRuntimeAdapter('profileRepository').getStore();
  const getUserState = toRef(useRepositoryProfilesStore, 'getUserState');
  const getProfileByIdState = toRef(useRepositoryProfilesStore, 'getProfileByIdState');
  let initPromise: Promise<void> | null = null;

  const userProfiles = computed(() => sortProfilesByUpdatedAt(
    getUserState.value?.data?.profiles || [],
  ));
  const selectedUserProfileId = ref(cookies.get('selectedUserProfileId'));
  const profileByIdInProfilesList = computed(() => (
    userProfiles.value.find((item) => item.id === selectedUserProfileId.value)));
  const selectedProfileDetails = computed(() => {
    const currentProfileDetails = getProfileByIdState.value?.data;

    if (!currentProfileDetails) {
      return undefined;
    }

    return currentProfileDetails.id === Number(selectedUserProfileId.value)
      ? currentProfileDetails
      : undefined;
  });
  const selectedUserProfileData = computed(() => (
    { ...profileByIdInProfilesList.value, ...selectedProfileDetails.value }));
  const selectedUserProfileType = computed(() => (
    userProfiles.value.find((item: { id: number; type: string }) => (
      item.id === Number(selectedUserProfileId.value)))?.type));
  const selectedUserIndividualProfile = computed(() => userProfiles.value.find((profile: { type: string }) => profile.type === 'individual'));

  const isSelectedProfileLoading = computed(() => (
    getProfileByIdState.value?.loading || getUserState.value?.loading || false));

  const urlProfileId = computed(() => {
    if (!isStaticSite) return route?.params?.profileId;
    if (typeof window === 'undefined') return undefined;
    return window.location.pathname.split('/')[3]; // TODO change if url changes
  });

  const isUrlProfileSameAsSelected = computed(() => Number(urlProfileId.value) === selectedUserProfileId.value);

  const selectedUserProfileRiskAcknowledged = computed(() => {
    const profileData = selectedUserProfileData.value?.data;
    if (profileData?.educational_materials && profileData?.cancelation_restrictions
      && profileData?.resell_difficulties && profileData?.risk_involved
      && profileData?.no_legal_advices_from_company) return true;
    return false;
  });

  const selectedUserProfileAccreditationDataOK = computed(() => {
    const profileData = selectedUserProfileData.value?.data;
    if (!profileData?.accredited_investor) return false;
    return Boolean(profileData?.accredited_investor);
  });

  const selectedUserProfielKYCStatusNotStarted = computed(() => (
    selectedProfileDetails.value?.kyc_status === 'new'
  ));

  // Risk acknowledgements are no longer part of the default KYC form, so they
  // do not gate profile completeness; selectedUserProfileRiskAcknowledged
  // stays exposed for the account-details read-only view.
  const selectedUserProfileShowKycInitFormIndividual = computed(() => ((
    !selectedProfileDetails.value?.data?.citizenship
    || !selectedUserProfileAccreditationDataOK.value || selectedUserProfielKYCStatusNotStarted.value
  ) && (selectedUserProfileType.value === PROFILE_TYPES.INDIVIDUAL)));

  const selectedUserProfileShowKycInitForm = computed(() => (
    selectedUserProfileShowKycInitFormIndividual.value));

  const isTrustRevocable = computed(() => (
    (selectedUserProfileType.value?.toLowerCase() === PROFILE_TYPES.TRUST) && selectedUserProfileData.value?.data?.type?.toLowerCase().includes('revocable')));

  // KYC status checking functions
  const isCurrentProfileKycApproved = computed(() => {
    const currentProfile = profileByIdInProfilesList.value;
    return currentProfile?.isKycApproved;
  });

  const getKycApprovedProfiles = computed(() => {
    return userProfiles.value.filter(profile => profile.isKycApproved);
  });

  const hasAnyKycApprovedProfile = computed(() => {
    return getKycApprovedProfiles.value.length > 0;
  });

  const waitForActiveUserLoad = () => new Promise<void>((resolve) => {
    if (!getUserState.value?.loading) {
      resolve();
      return;
    }

    const stop = watch(() => getUserState.value?.loading, (loading) => {
      if (!loading) {
        stop();
        resolve();
      }
    });
  });

  const resetSelectedProfile = () => {
    selectedUserProfileId.value = 0;
    cookies.remove('selectedUserProfileId', cookiesOptions(new Date(0)));
  };

  const init = async (options: InitProfilesOptions = {}) => {
    if (!userLoggedIn.value) {
      return;
    }
    if (!options.force && getUserState.value?.data) {
      return;
    }
    if (!options.force && initPromise) {
      return initPromise;
    }
    if (options.force) {
      if (initPromise) {
        await initPromise;
      } else if (getUserState.value?.loading) {
        await waitForActiveUserLoad();
      }
      useRepositoryProfilesStore.resetAll();
      resetSelectedProfile();
    }

    const loadProfiles = async () => {
      if (getUserState.value?.loading) {
        await waitForActiveUserLoad();
        return;
      }

      try {
        await useRepositoryProfilesStore.getUser();
      } catch (error) {
        reportOfflineReadError(error, 'Failed to load profiles');
      }
    };

    initPromise = loadProfiles().finally(() => {
      initPromise = null;
    });

    return initPromise;
  };
  // if user is logged in and profile is not loaded, load it - step 1
  watch(() => userLoggedIn.value, () => {
    void init();
  }, { immediate: true });

  // if there is error in getUser (profiles) call logout - could happen if session expired
  watch(() => getUserState.value.error, async () => {
    if (getUserState.value.error) {
      if (shouldPreserveOfflineSession(userSession.value, getUserState.value.error)) {
        return;
      }
      void requestLogout();
    }
  }, { immediate: true });

  const setSelectedUserProfileById = (id: number) => {
    
    const newProfileId = Number(id);
    const profileChanged = selectedUserProfileId.value !== newProfileId;
    
    // Only reset all profile-dependent repositories if profile actually changed
    // This prevents unnecessary data clearing when navigating between routes with the same profile
    if (profileChanged) {
      resetAllProfileData();
    }
    
    // Update the selected profile ID
    selectedUserProfileId.value = newProfileId;
    
    if (id === 0) return;
    
    // Save to cookies - use session expires_at when valid, otherwise fallback to 1 year
    const expiresAt = userSession.value?.expires_at;
    const expireDate = expiresAt ? new Date(expiresAt) : null;
    const validExpireDate = (expireDate && !Number.isNaN(expireDate.getTime()))
      ? expireDate
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

    cookies.set(
      'selectedUserProfileId',
      id,
      cookiesOptions(validExpireDate),
    );
  };

  const updateSelectedAccount = () => {
    const profileType = selectedUserProfileType.value;
    if (!profileType) return;
    useRepositoryProfilesStore.getProfileById(profileType, selectedUserProfileId.value);
  };

  const updateDataInProfile = (nameOfProperty: string, data: unknown) => {
    if (getProfileByIdState.value?.data) {
      (getProfileByIdState.value.data as unknown as Record<string, unknown>)[nameOfProperty] = data;
    }
  };

  const updateData = (notification: INotification) => {
    const profile = userProfiles.value.find(
      (item) => item.id === notification.data.fields?.object_id,
    );

    if (profile && notification.data.fields) {
      Object.assign(profile, notification.data.fields);
    }

    const profileData = getProfileByIdState.value?.data;
    if (profileData?.id === notification.data.fields?.object_id) {
      Object.assign(profileData as unknown as Record<string, unknown>, notification.data.fields);
    }
  };

  // On initial user load, select the most recently updated profile when there
  // is no persisted selection.
  watch(() => userProfiles.value[0]?.id, () => {
    if ((!selectedUserProfileId.value || selectedUserProfileId.value === 0) && (userProfiles.value[0]?.id > 0)) {
      setSelectedUserProfileById(userProfiles.value[0]?.id);
    }
  }, { immediate: true });

  watch(() => [selectedUserProfileId.value, selectedUserProfileType.value, isUrlProfileSameAsSelected.value], () => {
    const profileId = Number(selectedUserProfileId.value);
    const profileType = selectedUserProfileType.value;
    const urlMatchesSelectedProfile = isUrlProfileSameAsSelected.value;

    if (userLoggedIn.value && urlMatchesSelectedProfile
      && profileType && (profileId > 0)) {
      // Clear profile data before fetching to prevent brief flash of old data
      // This ensures the UI shows loading state instead of stale data
      useRepositoryProfilesStore.resetProfileData();
      
      // Fetch new profile data
      void Promise.resolve().then(() => useRepositoryProfilesStore.getProfileById(
        profileType,
        profileId,
      )).catch((error) => reportOfflineReadError(error, 'Failed to load profile details'));
      void Promise.resolve().then(() => useRepositoryProfilesStore.getProfileByIdOptions(
        profileType,
        profileId,
      )).catch(() => undefined);
    }
  }, { immediate: true });

  return {
    // State
    userProfiles,
    selectedUserProfileId,
    selectedUserProfileData,
    selectedUserProfileType,
    isSelectedProfileLoading,
    selectedUserIndividualProfile,
    selectedUserProfileShowKycInitForm,
    isTrustRevocable,
    selectedUserProfileRiskAcknowledged,

    // KYC-related computed properties
    isCurrentProfileKycApproved,
    getKycApprovedProfiles,
    hasAnyKycApprovedProfile,

    // Methods
    setSelectedUserProfileById,
    updateSelectedAccount,
    updateDataInProfile,
    updateData,
    init,
    resetSelectedProfile,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProfilesStore, import.meta.hot));
}
