import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { useCookies } from '@vueuse/integrations/useCookies';
import { useRoute } from 'vue-router';
import { ref, computed, reactive } from 'vue';
import { useProfilesStore } from '../useProfiles.ts';
import { resetAllProfileData } from '@global-torque/invest-runtime/reset';
import {
  clearDomainLifecycleHandlersForTests,
  registerLogoutRequestHandler,
} from '@global-torque/invest-runtime/lifecycle';

const { useRepositoryProfiles } = vi.hoisted(() => ({
  useRepositoryProfiles: vi.fn(),
}));
const appConfig = reactive({ isStaticSite: false });

type MockUserProfile = {
  id: number;
  type: string;
  name: string;
  updated_at?: string;
};

type MockGetUserState = {
  data: { profiles: MockUserProfile[] } | undefined;
  loading: boolean;
  error: unknown;
};

// Mock dependencies
vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
}));

vi.mock('@vueuse/integrations/useCookies', () => ({
  useCookies: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: vi.fn(),
  cookiesOptions: (expires?: Date) => ({
    path: '/',
    ...(expires ? { expires } : {}),
  }),
}));

vi.mock('../../../adapters.ts', () => ({
  getRequiredInvestRuntimeAdapter: () => ({
    getStore: () => useRepositoryProfiles(),
  }),
}));

vi.mock('../../../applicationContext.ts', () => ({
  useInvestApplicationContext: () => ({ appConfig }),
}));

vi.mock('@global-torque/invest-runtime/reset', () => ({
  resetAllProfileData: vi.fn(),
}));

let logoutRequestHandler: () => void;

describe('useProfilesStore', () => {
  beforeEach(() => {
    appConfig.isStaticSite = false;
    setActivePinia(createPinia());
    
    // Clear all mocks
    vi.clearAllMocks();
    clearDomainLifecycleHandlersForTests();
    logoutRequestHandler = vi.fn();
    registerLogoutRequestHandler('test-logout', () => logoutRequestHandler());

    // Mock route
    (useRoute as any).mockReturnValue({
      params: { profileId: '123' },
    });

    // Mock cookies
    (useCookies as any).mockReturnValue({
      set: vi.fn(),
      get: vi.fn().mockReturnValue(0),
      remove: vi.fn(),
    });

    // Mock session store
    const mockSessionStore = {
      userSession: ref({
        active: true,
        expires_at: '2024-12-31',
        identity: { traits: {} },
      }),
      userLoggedIn: computed(() => true),
      userSessionTraits: computed(() => ({})),
    };
    (useSessionStore as any).mockReturnValue(mockSessionStore);

    // Mock repository
    const mockRepository = {
      getUserState: ref({
        data: {
          profiles: [
            { id: 123, type: 'individual', name: 'Test Profile' },
            { id: 456, type: 'sdira', name: 'Company Profile' },
          ],
        },
        loading: false,
        error: null,
      }),
      getProfileByIdState: ref({
        data: { id: 123, type: 'individual', name: 'Test Profile' },
        loading: false,
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue(undefined),
      getProfileById: vi.fn().mockResolvedValue(undefined),
      getProfileByIdOptions: vi.fn().mockResolvedValue(undefined),
      resetProfileData: vi.fn(),
      resetAll: vi.fn(),
    };
    (useRepositoryProfiles as any).mockReturnValue(mockRepository);
  });

  afterEach(() => {
    appConfig.isStaticSite = false;
    window.history.pushState({}, '', '/');
  });

  it('should initialize with default values when user is logged in', () => {
    const store = useProfilesStore();
    // When user is logged in and profiles are available, the store automatically selects the first profile
    expect(store.selectedUserProfileId).toBe(123);
    expect(store.userProfiles).toEqual([
      { id: 123, type: 'individual', name: 'Test Profile' },
      { id: 456, type: 'sdira', name: 'Company Profile' },
    ]);
  });

  it('orders profiles by updated_at and selects the most recently updated profile', () => {
    setActivePinia(createPinia());

    const getUserState = ref<MockGetUserState>({
      data: {
        profiles: [
          {
            id: 123,
            type: 'individual',
            name: 'Older Profile',
            updated_at: '2026-07-20T08:00:00Z',
          },
          {
            id: 456,
            type: 'sdira',
            name: 'Newest Profile',
            updated_at: '2026-07-24T12:00:00Z',
          },
          {
            id: 789,
            type: 'trust',
            name: 'Newest Profile With Same Timestamp',
            updated_at: '2026-07-24T12:00:00Z',
          },
          {
            id: 101,
            type: 'entity',
            name: 'Invalid Timestamp Profile',
            updated_at: 'invalid-date',
          },
          {
            id: 202,
            type: 'solo401k',
            name: 'Missing Timestamp Profile',
          },
        ],
      },
      loading: false,
      error: null,
    });

    (useRepositoryProfiles as any).mockReturnValue({
      getUserState,
      getProfileByIdState: ref({
        data: undefined,
        loading: false,
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue(undefined),
      getProfileById: vi.fn().mockResolvedValue(undefined),
      getProfileByIdOptions: vi.fn().mockResolvedValue(undefined),
      resetProfileData: vi.fn(),
      resetAll: vi.fn(),
    });

    const store = useProfilesStore();

    expect(store.userProfiles.map(profile => profile.id)).toEqual([
      456,
      789,
      123,
      101,
      202,
    ]);
    expect(store.selectedUserProfileId).toBe(456);
  });

  it('uses useRoute when IS_STATIC_SITE is 0', () => {
    useProfilesStore();

    expect(useRoute).toHaveBeenCalledTimes(1);
  });

  it('avoids useRoute and reads the profile id from window pathname when IS_STATIC_SITE is 1', async () => {
    appConfig.isStaticSite = true;
    window.history.pushState({}, '', '/static/profile/456/summary');

    (useRoute as any).mockImplementation(() => {
      throw new Error('useRoute should not be called in static-site mode');
    });
    (useCookies as any).mockReturnValue({
      set: vi.fn(),
      get: vi.fn().mockReturnValue(456),
      remove: vi.fn(),
    });

    useProfilesStore();
    const repository = useRepositoryProfiles();

    await vi.waitFor(() => {
      expect(repository.getProfileById).toHaveBeenCalledWith('sdira', 456);
    });
    expect(useRoute).not.toHaveBeenCalled();
  });

  it('should initialize with 0 when user is not logged in', () => {
    // Reset Pinia store
    setActivePinia(createPinia());

    // Mock cookies to return 0
    (useCookies as any).mockReturnValue({
      set: vi.fn(),
      get: vi.fn().mockReturnValue(0),
      remove: vi.fn(),
    });

    // Mock session store with user not logged in
    const mockSessionStore = {
      userSession: ref({
        active: false,
        expires_at: '2024-12-31',
        identity: { traits: {} },
      }),
      userLoggedIn: computed(() => false),
      userSessionTraits: computed(() => ({})),
    };
    (useSessionStore as any).mockReturnValue(mockSessionStore);

    // Mock repository with empty profiles
    const mockRepository = {
      getUserState: ref({
        data: {
          profiles: [],
        },
        loading: false,
        error: null,
      }),
      getProfileByIdState: ref({
        data: null,
        loading: false,
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue(undefined),
      getProfileById: vi.fn().mockResolvedValue(undefined),
      getProfileByIdOptions: vi.fn().mockResolvedValue(undefined),
      resetProfileData: vi.fn(),
      resetAll: vi.fn(),
    };
    (useRepositoryProfiles as any).mockReturnValue(mockRepository);

    const store = useProfilesStore();
    expect(store.selectedUserProfileId).toBe(0);
  });

  it('should initialize with 0 when user is logged in but no profiles available', () => {
    // Reset Pinia store
    setActivePinia(createPinia());

    // Mock cookies to return 0
    (useCookies as any).mockReturnValue({
      set: vi.fn(),
      get: vi.fn().mockReturnValue(0),
      remove: vi.fn(),
    });

    // Mock session store with user logged in
    const mockSessionStore = {
      userSession: ref({
        active: true,
        expires_at: '2024-12-31',
        identity: { traits: {} },
      }),
      userLoggedIn: computed(() => true),
      userSessionTraits: computed(() => ({})),
    };
    (useSessionStore as any).mockReturnValue(mockSessionStore);

    // Mock repository with empty profiles
    const mockRepository = {
      getUserState: ref({
        data: {
          profiles: [],
        },
        loading: false,
        error: null,
      }),
      getProfileByIdState: ref({
        data: null,
        loading: false,
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue(undefined),
      getProfileById: vi.fn().mockResolvedValue(undefined),
      getProfileByIdOptions: vi.fn().mockResolvedValue(undefined),
      resetProfileData: vi.fn(),
      resetAll: vi.fn(),
    };
    (useRepositoryProfiles as any).mockReturnValue(mockRepository);

    const store = useProfilesStore();
    expect(store.selectedUserProfileId).toBe(0);
  });

  it('should set selected user profile', () => {
    const store = useProfilesStore();
    store.setSelectedUserProfileById(123);
    expect(store.selectedUserProfileId).toBe(123);
    expect(resetAllProfileData).toHaveBeenCalled();
  });

  it('should clear selected user profile and reset data if id is 0', () => {
    const store = useProfilesStore();
    
    // Clear mocks after store initialization to ignore initialization calls
    // The watcher may have triggered setSelectedUserProfileById during initialization
    vi.clearAllMocks();
    
    // Store should already have a selected profile from initialization
    expect(store.selectedUserProfileId).toBe(123);
    expect(resetAllProfileData).not.toHaveBeenCalled();

    // Calling with the same ID should not reset data
    store.setSelectedUserProfileById(123);
    expect(store.selectedUserProfileId).toBe(123);
    expect(resetAllProfileData).not.toHaveBeenCalled();

    // Calling with 0 should clear the selected profile and reset data once
    store.setSelectedUserProfileById(0);
    expect(store.selectedUserProfileId).toBe(0);
    expect(resetAllProfileData).toHaveBeenCalledTimes(1);
  });

  it('should update selected account', () => {
    const store = useProfilesStore();
    store.setSelectedUserProfileById(123);
    store.updateSelectedAccount();

    const repository = useRepositoryProfiles();
    expect(repository.getProfileById).toHaveBeenCalledWith('individual', 123);
  });

  it('should update data in profile', () => {
    const store = useProfilesStore();
    store.setSelectedUserProfileById(123);
    store.updateDataInProfile('name', 'Updated Name');

    expect((store.selectedUserProfileData as { name?: string })?.name).toBe('Updated Name');
  });

  it('should update data from notification', () => {
    const store = useProfilesStore();
    store.setSelectedUserProfileById(123);

    const notification = {
      data: {
        fields: {
          object_id: 123,
          name: 'Updated Name',
        },
      },
    };

    store.updateData(notification as any);
    expect((store.selectedUserProfileData as { name?: string })?.name).toBe('Updated Name');
  });

  it('clears the selected profile cookie when resetting the selected profile', () => {
    const remove = vi.fn();
    (useCookies as any).mockReturnValue({
      set: vi.fn(),
      get: vi.fn().mockReturnValue(123),
      remove,
    });

    const store = useProfilesStore();
    store.resetSelectedProfile();

    expect(store.selectedUserProfileId).toBe(0);
    expect(remove).toHaveBeenCalledWith('selectedUserProfileId', expect.any(Object));
  });

  it('keeps validated profile request arguments when selection resets before deferred requests run', async () => {
    const store = useProfilesStore();
    const repository = useRepositoryProfiles();

    store.resetSelectedProfile();

    await vi.waitFor(() => {
      expect(repository.getProfileById).toHaveBeenCalledWith('individual', 123);
      expect(repository.getProfileByIdOptions).toHaveBeenCalledWith('individual', 123);
    });
    expect(repository.getProfileById).not.toHaveBeenCalledWith(undefined, 0);
    expect(repository.getProfileByIdOptions).not.toHaveBeenCalledWith(undefined, 0);
  });

  it('should handle profile selection when user is logged in', () => {
    const store = useProfilesStore();
    const repository = useRepositoryProfiles();

    // User is already logged in from the mock setup
    store.setSelectedUserProfileById(123);
    store.updateSelectedAccount();

    expect(resetAllProfileData).toHaveBeenCalled();
    expect(repository.getProfileById).toHaveBeenCalledWith('individual', 123);
  });

  it('shares an in-flight profile initialization promise between callers', async () => {
    setActivePinia(createPinia());

    const getUserState = ref({
      data: undefined,
      loading: false,
      error: null,
    });
    let resolveGetUser!: () => void;
    const getUser = vi.fn(() => new Promise<void>((resolve) => {
      resolveGetUser = resolve;
    }));

    (useRepositoryProfiles as any).mockReturnValue({
      getUserState,
      getProfileByIdState: ref({
        data: undefined,
        loading: false,
        error: null,
      }),
      getUser,
      getProfileById: vi.fn(),
      getProfileByIdOptions: vi.fn(),
      resetProfileData: vi.fn(),
      resetAll: vi.fn(),
    });

    const store = useProfilesStore();

    await vi.waitFor(() => {
      expect(getUser).toHaveBeenCalledTimes(1);
    });

    let secondInitResolved = false;
    const secondInit = store.init().then(() => {
      secondInitResolved = true;
    });

    await Promise.resolve();

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(secondInitResolved).toBe(false);

    resolveGetUser();
    await secondInit;

    expect(secondInitResolved).toBe(true);
  });

  it('waits for an already-running profile load before resolving init', async () => {
    setActivePinia(createPinia());

    const getUserState = ref<MockGetUserState>({
      data: undefined,
      loading: true,
      error: null,
    });
    const getUser = vi.fn();

    (useRepositoryProfiles as any).mockReturnValue({
      getUserState,
      getProfileByIdState: ref({
        data: undefined,
        loading: false,
        error: null,
      }),
      getUser,
      getProfileById: vi.fn(),
      getProfileByIdOptions: vi.fn(),
      resetProfileData: vi.fn(),
      resetAll: vi.fn(),
    });

    const store = useProfilesStore();

    let initResolved = false;
    const initPromise = store.init().then(() => {
      initResolved = true;
    });

    await Promise.resolve();

    expect(getUser).not.toHaveBeenCalled();
    expect(initResolved).toBe(false);

    getUserState.value = {
      data: { profiles: [{ id: 123, type: 'individual', name: 'Test Profile' }] },
      loading: false,
      error: null,
    };

    await initPromise;

    expect(initResolved).toBe(true);
  });

  it('force reloads profiles even when profile data already exists', async () => {
    setActivePinia(createPinia());

    const getUserState = ref<MockGetUserState>({
      data: { profiles: [{ id: 111, type: 'individual', name: 'Old Profile' }] },
      loading: false,
      error: null,
    });
    const resetAll = vi.fn(() => {
      getUserState.value = {
        data: undefined,
        loading: false,
        error: null,
      };
    });
    const getUser = vi.fn(async () => {
      getUserState.value = {
        data: { profiles: [{ id: 222, type: 'individual', name: 'New Profile' }] },
        loading: false,
        error: null,
      };
    });

    (useRepositoryProfiles as any).mockReturnValue({
      getUserState,
      getProfileByIdState: ref({
        data: undefined,
        loading: false,
        error: null,
      }),
      getUser,
      getProfileById: vi.fn(),
      getProfileByIdOptions: vi.fn(),
      resetProfileData: vi.fn(),
      resetAll,
    });

    const store = useProfilesStore();

    await store.init({ force: true });

    expect(resetAll).toHaveBeenCalled();
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(store.userProfiles).toEqual([{ id: 222, type: 'individual', name: 'New Profile' }]);
  });

  it('should reset all profile data when switching profiles', () => {
    const store = useProfilesStore();
    
    // Clear previous calls
    vi.clearAllMocks();
    
    // Switch to a different profile
    store.setSelectedUserProfileById(456);
    
    // Verify resetAllProfileData was called to clear stale data
    expect(resetAllProfileData).toHaveBeenCalledTimes(1);
    expect(store.selectedUserProfileId).toBe(456);
  });

  it('requests logout when profiles fail to load online', async () => {
    setActivePinia(createPinia());

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    const profileError = new Error('Unauthorized');

    (useRepositoryProfiles as any).mockReturnValue({
      getUserState: ref({
        data: undefined,
        loading: false,
        error: profileError,
      }),
      getProfileByIdState: ref({
        data: undefined,
        loading: false,
        error: null,
      }),
      getUser: vi.fn().mockRejectedValue(profileError),
      getProfileById: vi.fn(),
      getProfileByIdOptions: vi.fn(),
      resetProfileData: vi.fn(),
      resetAll: vi.fn(),
    });

    useProfilesStore();

    await Promise.resolve();

    expect(logoutRequestHandler).toHaveBeenCalledTimes(1);
  });

  it('preserves the local session when profiles fail to load offline', async () => {
    setActivePinia(createPinia());

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    const profileError = new Error('Failed to fetch');
    const getUserState = ref({
      data: undefined,
      loading: false,
      error: profileError,
    });

    (useRepositoryProfiles as any).mockReturnValue({
      getUserState,
      getProfileByIdState: ref({
        data: undefined,
        loading: false,
        error: null,
      }),
      getUser: vi.fn().mockRejectedValue(profileError),
      getProfileById: vi.fn(),
      getProfileByIdOptions: vi.fn(),
      resetProfileData: vi.fn(),
      resetAll: vi.fn(),
    });

    useProfilesStore();

    await Promise.resolve();

    expect(logoutRequestHandler).not.toHaveBeenCalled();
  });
});
