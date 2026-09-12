import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  configureInvestRuntimeAdapters,
  resetInvestRuntimeAdaptersForTests,
} from '../adapters.ts';
import {
  clearDomainLifecycleHandlersForTests,
  registerFullResetTarget,
  registerProfileResetTarget,
} from '../lifecycle/domainLifecycle.ts';

const sessionResetAll = vi.fn();
const clearPrivatePwaData = vi.fn();
const cleanupNativePush = vi.fn();

vi.mock('../session/store/useSession.ts', () => ({
  cookiesOptions: () => ({ path: '/', secure: true, sameSite: 'lax' }),
  useSessionStore: () => ({ resetAll: sessionResetAll }),
}));

vi.mock('../pwa/pwaOfflineStore.ts', () => ({
  clearPrivatePwaData,
}));

vi.mock('../nativePush/nativePushBridge.ts', () => ({
  cleanupNativePushBridgeOnLogout: cleanupNativePush,
}));

const {
  resetAllData,
  resetAllProfileData,
  resetDataForIdentityChange,
} = await import('../resetAllData.ts');

describe('resetAllData', () => {
  const resetSelectedProfile = vi.fn();
  const resetAccountData = vi.fn();
  const resetProfileData = vi.fn();
  const resetProfileRepositories = vi.fn();
  const resetFullRepositories = vi.fn();
  const authResetAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetInvestRuntimeAdaptersForTests();
    clearDomainLifecycleHandlersForTests();
    configureInvestRuntimeAdapters({
      auth: {
        getSession: async () => null,
        resetAll: authResetAll,
      },
      profiles: {
        init: vi.fn(),
        getUserProfiles: () => [],
        getSelectedUserProfileId: () => 0,
        setSelectedUserProfileById: vi.fn(),
        resetSelectedProfile,
        resetAccountData,
        resetProfileData,
        loadUserProfiles: vi.fn(),
      },
      repositories: {
        resetProfileRepositories,
        resetFullRepositories,
      },
    });
  });

  afterEach(() => {
    resetInvestRuntimeAdaptersForTests();
    clearDomainLifecycleHandlersForTests();
  });

  it('resets profile-scoped runtime data and registered profile targets', () => {
    const profileTarget = vi.fn();
    registerProfileResetTarget('test-profile', profileTarget);

    resetAllProfileData();

    expect(resetProfileData).toHaveBeenCalledTimes(1);
    expect(resetAccountData).not.toHaveBeenCalled();
    expect(profileTarget).toHaveBeenCalledTimes(1);
    expect(resetProfileRepositories).toHaveBeenCalledTimes(1);
    expect(clearPrivatePwaData).toHaveBeenCalledTimes(1);
  });

  it('cleans native push, session, adapters, full targets, and private PWA data on full reset', async () => {
    const fullTarget = vi.fn();
    registerFullResetTarget('test-full', fullTarget);

    await resetAllData();

    expect(cleanupNativePush).toHaveBeenCalledTimes(1);
    expect(sessionResetAll).toHaveBeenCalledTimes(1);
    expect(resetSelectedProfile).toHaveBeenCalledTimes(1);
    expect(resetAccountData).toHaveBeenCalledTimes(1);
    expect(sessionResetAll.mock.invocationCallOrder[0]).toBeLessThan(resetAccountData.mock.invocationCallOrder[0]);
    expect(resetAccountData.mock.invocationCallOrder[0]).toBeLessThan(fullTarget.mock.invocationCallOrder[0]);
    expect(authResetAll).toHaveBeenCalledTimes(1);
    expect(fullTarget).toHaveBeenCalledTimes(1);
    expect(resetProfileRepositories).toHaveBeenCalledTimes(1);
    expect(resetFullRepositories).toHaveBeenCalledTimes(1);
    expect(clearPrivatePwaData).toHaveBeenCalledTimes(1);
  });

  it('clears previous-identity data without clearing the replacement session', async () => {
    const fullTarget = vi.fn();
    registerFullResetTarget('test-full', fullTarget);

    await resetDataForIdentityChange();

    expect(cleanupNativePush).toHaveBeenCalledTimes(1);
    expect(sessionResetAll).not.toHaveBeenCalled();
    expect(resetSelectedProfile).toHaveBeenCalledTimes(1);
    expect(resetAccountData).toHaveBeenCalledTimes(1);
    expect(authResetAll).toHaveBeenCalledTimes(1);
    expect(fullTarget).toHaveBeenCalledTimes(1);
    expect(resetProfileData).toHaveBeenCalledTimes(1);
    expect(resetProfileRepositories).toHaveBeenCalledTimes(1);
    expect(resetFullRepositories).toHaveBeenCalledTimes(1);
    expect(clearPrivatePwaData).toHaveBeenCalledTimes(1);
  });
});
