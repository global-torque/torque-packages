// @ts-nocheck
import { ref, computed } from 'vue';
import { acceptHMRUpdate, defineStore } from 'pinia';
import { createInvestDataApiClient } from '@global-torque/invest-data/service/dataClientConfig';
import {
  applyOfflineHydrationMeta,
  createRepositoryStates,
  withActionState,
  type OptionsStateData,
} from '@global-torque/invest-runtime/repository/action-state';
import {
  IProfileData, IUser, IProfileIndividual, ISchema,
  IProfileFormatted,
} from '@global-torque/domain-types/profilesTypes';
import { UserFormatter } from './formatter/user.formatter.ts';
import { IUserFormatted } from '@global-torque/domain-types/profilesTypes';
import { INotification } from '@global-torque/domain-types/notificationsTypes';
import { ProfileFormatter } from './formatter/profiles.formatter.ts';
import { createFormatterCache } from '@global-torque/invest-core/repository/formatterCache';

type ProfilesStates = {
  setProfileByIdState: IProfileIndividual;
  getProfileByIdState: IProfileFormatted;
  getProfileByIdOptionsState: IProfileIndividual;
  setProfileState: IProfileData;
  getUserState: IUserFormatted;
  setUserState: IProfileData;
  setUserOptionsState: OptionsStateData;
  updateUserDataState: OptionsStateData;
  getProfileOptionsState: ISchema;
};

export const useRepositoryProfiles = defineStore('repository-profiles', () => {
  const apiClient = createInvestDataApiClient('user');
  const profileCache = createFormatterCache<IProfileIndividual, IProfileFormatted>({
    getKey: (profile) => Number(profile.id) || 0,
    getSignature: (profile) => [
      profile.updated_at ?? '',
      profile.type ?? '',
      profile.name ?? '',
      profile.kyc_id ?? '',
      profile.accreditation_id ?? '',
      profile.kyc_status ?? '',
      profile.accreditation_status ?? '',
      profile.kyc_at ?? '',
      profile.accreditation_at ?? '',
      profile.created_at ?? '',
      profile.updated_by ?? '',
      profile.wallet?.id ?? '',
      profile.wallet?.status ?? '',
      JSON.stringify(profile.data ?? {}),
    ].join('|'),
    format: (profile) => new ProfileFormatter(profile).format(),
  });
  const userCache = createFormatterCache<IUser, IUserFormatted>({
    getKey: (user) => Number(user.id) || 0,
    getSignature: (user) => [
      user.first_name ?? '',
      user.last_name ?? '',
      user.phone ?? '',
      user.created_at ?? '',
      user.updated_at ?? '',
      user.image_link_id ?? '',
      user.profiles?.length ?? 0,
      (user.profiles ?? [])
        .map((profile) => `${profile?.id ?? ''}:${profile?.updated_at ?? ''}`)
        .join(';'),
    ].join('|'),
    format: (user) => new UserFormatter(user, (profile) => profileCache.format(profile)).format(),
  });

  const profileOptions = ref<ISchema>();
  let currentProfileRequestId = 0;
  let currentProfileOptionsRequestId = 0;
  let currentUserRequestId = 0;

  const {
    setProfileByIdState,
    getProfileByIdState,
    getProfileByIdOptionsState,
    setProfileState,
    getUserState,
    setUserState,
    setUserOptionsState,
    updateUserDataState,
    getProfileOptionsState,
    resetAll: resetActionStates,
  } = createRepositoryStates<ProfilesStates>({
    setProfileByIdState: undefined,
    getProfileByIdState: undefined,
    getProfileByIdOptionsState: undefined,
    setProfileState: undefined,
    getUserState: undefined,
    setUserState: undefined,
    setUserOptionsState: undefined,
    updateUserDataState: undefined,
    getProfileOptionsState: undefined,
  });

  // Computed
  const formattedProfileData = computed(() => setProfileState.value.data);

  // Actions
  const getProfileOptions = async (type: string) =>
    withActionState(getProfileOptionsState, async () => {
      const response = await apiClient.options<ISchema>(`/auth/profile/${type}`);
      const data = response.data;
      if (data?.definitions?.RegCF) {
        delete data.definitions.RegCF?.required;
      }
      return data;
    });

  const setProfile = async (data: IProfileData, type: string) =>
    withActionState(setProfileState, async () => {
      const response = await apiClient.post<IProfileData>(`/auth/profile/${type}`, data);
      return response.data;
    });

  const getProfileById = async (type: string, id: string | number) => {
    // Increment request ID to track this request
    const requestId = ++currentProfileRequestId;
    
    try {
      getProfileByIdState.value.loading = true;
      getProfileByIdState.value.error = null;
      const response = await apiClient.get<IProfileIndividual>(`/auth/profile/${type}/${id}`);
      
      // Only apply the response if this is still the latest request
      // This prevents stale responses from overwriting current profile data
      if (requestId === currentProfileRequestId) {
        getProfileByIdState.value.data = profileCache.format(response.data as IProfileIndividual);
        applyOfflineHydrationMeta(getProfileByIdState, response.headers);
      }
      
      return getProfileByIdState.value.data;
    } catch (err) {
      // Only apply error if this is still the latest request
      if (requestId === currentProfileRequestId) {
        getProfileByIdState.value.error = err as Error;
        getProfileByIdState.value.data = undefined;
      }
      throw err;
    } finally {
      // Only update loading state if this is still the latest request
      if (requestId === currentProfileRequestId) {
        getProfileByIdState.value.loading = false;
      }
    }
  };

  const getProfileByIdOptions = async (type: string, id: string | number) => {
    // Increment request ID to track this request
    const requestId = ++currentProfileOptionsRequestId;
    
    try {
      getProfileByIdOptionsState.value.loading = true;
      getProfileByIdOptionsState.value.error = null;
      const response = await apiClient.options<IProfileIndividual>(`/auth/profile/${type}/${id}`);
      
      // Only apply the response if this is still the latest request
      if (requestId === currentProfileOptionsRequestId) {
        getProfileByIdOptionsState.value.data = response.data;
      }
      
      return getProfileByIdOptionsState.value.data;
    } catch (err) {
      // Only apply error if this is still the latest request
      if (requestId === currentProfileOptionsRequestId) {
        getProfileByIdOptionsState.value.error = err as Error;
        getProfileByIdOptionsState.value.data = undefined;
      }
      throw err;
    } finally {
      // Only update loading state if this is still the latest request
      if (requestId === currentProfileOptionsRequestId) {
        getProfileByIdOptionsState.value.loading = false;
      }
    }
  };

  const setProfileById = async (data: IProfileData, type: string, id: string | number) =>
    withActionState(setProfileByIdState, async () => {
      const response = await apiClient.patch<IProfileIndividual>(`/auth/profile/${type}/${id}`, data);
      return response.data;
    });

  const getUser = async (options: {
    authoritative?: boolean;
    preserveDataOnError?: boolean;
  } = {}) => {
    const requestId = ++currentUserRequestId;
    const previousData = getUserState.value.data;
    getUserState.value.loading = true;
    getUserState.value.error = null;
    try {
      const response = await apiClient.get<IUser>('/auth/user', options.authoritative ? {
        params: { refresh: Date.now() },
        cache: 'no-store',
        offlineFallback: false,
        retry: 0,
      } : undefined);
      const user = response.data as IUser;
      profileCache.prune(
        (user.profiles ?? []).filter(
          (profile): profile is IProfileIndividual => Boolean(profile && typeof profile === 'object'),
        ),
      );
      const formatted = userCache.format(user);
      if (requestId === currentUserRequestId) {
        getUserState.value.data = formatted;
        applyOfflineHydrationMeta(getUserState, response.headers);
      }
      return formatted;
    } catch (error) {
      if (requestId === currentUserRequestId) {
        getUserState.value.error = error as Error;
        getUserState.value.data = options.preserveDataOnError ? previousData : undefined;
      }
      throw error;
    }
    finally {
      if (requestId === currentUserRequestId) getUserState.value.loading = false;
    }
  };

  const setOptimisticUserImageId = (imageLinkId: number) => {
    if (!getUserState.value.data) return;
    getUserState.value.data = {
      ...getUserState.value.data,
      image_link_id: imageLinkId,
    };
  };

  const setUser = async (data: IProfileData) =>
    withActionState(setUserState, async () => {
      const response = await apiClient.patch<IProfileData>('/auth/user', data);
      return response.data;
    });

  const setUserOptions = async () =>
    withActionState(setUserOptionsState, async () => {
      const response = await apiClient.options('/auth/user');
      return response.data;
    });

  const updateUserData = async (body: Record<string, unknown>) =>
    withActionState(updateUserDataState, async () => {
      const response = await apiClient.patch('/auth/user', body, {
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      return response.data;
    });

  const updateNotificationData = (notification: INotification) => {
    if (!notification?.data?.fields) return;
    const objectId = notification.data.fields?.object_id;
    const fields = notification.data.fields;
    // Update in user profiles list if present
    const userData = getUserState.value.data;
    if (userData?.profiles && objectId !== undefined) {
      const profileIndex = userData.profiles.findIndex((item: { id: number }) => item.id === objectId);
      if (profileIndex >= 0 && fields) {
        const updated = { ...userData.profiles[profileIndex], ...fields };
        const formatted = profileCache.format(updated as IProfileIndividual);
        const newProfiles = userData.profiles.map((p, i) => (i === profileIndex ? formatted : p));
        getUserState.value.data = { ...userData, profiles: newProfiles };
      }
    }
    // Update in currently loaded profile if it matches
    const currentProfile = getProfileByIdState.value?.data;
    if (currentProfile && currentProfile.id === objectId && fields) {
      const updated = { ...currentProfile, ...fields } as IProfileIndividual;
      getProfileByIdState.value.data = profileCache.format(updated);
    }
  };

  /**
   * Reset only profile-specific data (not user/profiles list data)
   * This is used when switching profiles to clear stale profile data
   * while preserving the profiles list
   */
  const resetProfileData = () => {
    // Increment request IDs to invalidate any in-flight requests
    // This ensures stale responses are ignored
    currentProfileRequestId++;
    currentProfileOptionsRequestId++;
    
    // Reset only profile-specific states, NOT getUserState which contains the profiles list
    setProfileByIdState.value = { loading: false, error: null, data: undefined };
    getProfileByIdState.value = { loading: false, error: null, data: undefined };
    getProfileByIdOptionsState.value = { loading: false, error: null, data: undefined };
    setProfileState.value = { loading: false, error: null, data: undefined };
    // Note: getUserState is NOT reset as it contains the profiles list which is shared across profiles
  };

  const resetAll = () => {
    currentUserRequestId += 1;
    profileCache.clear();
    userCache.clear();
    resetActionStates();
  };

  return {
    // State
    profileOptions,
    // Action states
    setProfileByIdState,
    getProfileByIdState,
    getProfileByIdOptionsState,
    setProfileState,
    getUserState,
    setUserState,
    setUserOptionsState,
    updateUserDataState,
    getProfileOptionsState,
    formattedProfileData,
    // Actions
    getProfileOptions,
    setProfile,
    getProfileById,
    getProfileByIdOptions,
    setProfileById,
    getUser,
    setUser,
    setUserOptions,
    updateUserData,
    setOptimisticUserImageId,
    resetAll,
    resetProfileData,
    updateNotificationData,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRepositoryProfiles, import.meta.hot));
}
