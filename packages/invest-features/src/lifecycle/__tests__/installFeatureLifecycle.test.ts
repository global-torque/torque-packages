import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  clearDomainLifecycleHandlersForTests,
  requestLogout,
  runFullResetTargets,
  runProfileResetTargets,
} from '@webdevelop-pro/invest-runtime/lifecycle';
import {
  installInvestmentFeatureLifecycle,
  resetInvestmentFeatureLifecycleForTests,
} from '../installFeatureLifecycle.ts';
import { ref } from 'vue';

const logoutHandler = vi.fn().mockResolvedValue({ status: 'navigation-started' });
const resetNotifications = vi.fn();
const resetAccreditation = vi.fn();
const resetKyc = vi.fn();
const resetOffers = vi.fn();

vi.mock('../../accreditation/useAccreditationModel.ts', () => ({
  useAccreditationModel: () => ({ resetAll: resetAccreditation }),
}));

vi.mock('../../kyc/model/useKycModel.ts', () => ({
  useKycModel: () => ({ resetAll: resetKyc }),
}));

vi.mock('../../notifications/useNotifications.ts', () => ({
  useNotifications: () => ({
    isSidebarOpen: ref(false),
    loadData: vi.fn(),
    loadAll: vi.fn().mockResolvedValue([]),
    onSidebarToggle: vi.fn(),
    updateNotificationsData: vi.fn(),
    resetAll: resetNotifications,
  }),
}));

vi.mock('../../offers/data/offer.repository.ts', () => ({
  useRepositoryOffer: () => ({ resetAll: resetOffers }),
}));

vi.mock('../../auth/store/useLogout.ts', () => ({
  useLogoutStore: () => ({
    logoutHandler,
  }),
}));

describe('installInvestmentFeatureLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDomainLifecycleHandlersForTests();
    resetInvestmentFeatureLifecycleForTests();
    logoutHandler.mockResolvedValue({ status: 'navigation-started' });
  });

  it('registers feature reset targets and logout request handling', async () => {
    installInvestmentFeatureLifecycle();

    runProfileResetTargets();
    await runFullResetTargets();
    await expect(requestLogout()).resolves.toBeUndefined();

    expect(resetNotifications).toHaveBeenCalledTimes(1);
    expect(resetOffers).toHaveBeenCalledTimes(1);
    expect(logoutHandler).toHaveBeenCalledTimes(1);
  });

  it('is idempotent', async () => {
    installInvestmentFeatureLifecycle();
    installInvestmentFeatureLifecycle();

    runProfileResetTargets();
    await runFullResetTargets();
    await requestLogout();

    expect(resetNotifications).toHaveBeenCalledTimes(1);
    expect(resetOffers).toHaveBeenCalledTimes(1);
    expect(logoutHandler).toHaveBeenCalledTimes(1);
  });
});
