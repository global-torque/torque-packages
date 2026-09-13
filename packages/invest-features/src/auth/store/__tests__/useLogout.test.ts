import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';
import { useRepositoryAuth } from '../../data/auth.repository.ts';
import { configureAuthNavigation } from '../../navigation.ts';
import { resetAllData } from '@global-torque/invest-runtime/reset';
import { useLogoutStore } from '../useLogout.ts';
import { SELFSERVICE } from '@global-torque/domain-types/authConstants';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';

const { mockGlobalLoaderHide } = vi.hoisted(() => ({
  mockGlobalLoaderHide: vi.fn(),
}));
const redirectAfterLogout = vi.fn();

vi.mock('../../data/auth.repository.ts', () => ({
  useRepositoryAuth: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/loader', () => ({
  useGlobalLoader: vi.fn(() => ({
    show: vi.fn(),
    hide: mockGlobalLoaderHide,
  })),
}));

vi.mock('@global-torque/invest-runtime/reset', () => ({
  resetAllData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({
  oryResponseHandling: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn(),
}));

describe('useLogoutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    configureAuthNavigation({ afterLogout: redirectAfterLogout });
  });

  it('should handle successful logout flow', async () => {
    const getAuthFlowState = ref({ error: null, data: { logout_token: 'test-token' } });
    const getLogoutState = ref({ error: null, data: null });

    const mockAuthRepository = {
      getAuthFlow: vi.fn().mockResolvedValue({}),
      getLogout: vi.fn().mockResolvedValue({}),
      getAuthFlowState,
      getLogoutState,
    };

    (useRepositoryAuth as any).mockReturnValue(mockAuthRepository);

    const store = useLogoutStore();
    const outcome = await store.logoutHandler();

    expect(mockAuthRepository.getAuthFlow).toHaveBeenCalledWith(SELFSERVICE.logout);
    expect(mockAuthRepository.getLogout).toHaveBeenCalledWith('test-token');
    expect(redirectAfterLogout).toHaveBeenCalled();
    expect(resetAllData).toHaveBeenCalled();
    expect(store.isLoading).toBe(false);
    expect(outcome).toEqual({ status: 'navigation-started' });
  });

  it('should extract token from logout_url if logout_token is not present', async () => {
    const getAuthFlowState = ref({ 
      error: null, 
      data: { logout_url: 'https://example.com/logout?token=url-token' } 
    });
    const getLogoutState = ref({ error: null, data: null });

    const mockAuthRepository = {
      getAuthFlow: vi.fn().mockResolvedValue({}),
      getLogout: vi.fn().mockResolvedValue({}),
      getAuthFlowState,
      getLogoutState,
    };

    (useRepositoryAuth as any).mockReturnValue(mockAuthRepository);

    const store = useLogoutStore();
    const outcome = await store.logoutHandler();

    expect(mockAuthRepository.getAuthFlow).toHaveBeenCalledWith(SELFSERVICE.logout);
    expect(mockAuthRepository.getLogout).toHaveBeenCalledWith('url-token');
    expect(redirectAfterLogout).toHaveBeenCalled();
    expect(resetAllData).toHaveBeenCalled();
    expect(store.isLoading).toBe(false);
    expect(outcome).toEqual({ status: 'navigation-started' });
  });

  it('can redirect to a fresh signup after logout', async () => {
    const getAuthFlowState = ref({ error: null, data: { logout_token: 'test-token' } });
    const getLogoutState = ref({ error: null, data: null });
    const mockAuthRepository = {
      getAuthFlow: vi.fn().mockResolvedValue({}),
      getLogout: vi.fn().mockResolvedValue({}),
      getAuthFlowState,
      getLogoutState,
    };
    (useRepositoryAuth as any).mockReturnValue(mockAuthRepository);

    const store = useLogoutStore();
    const outcome = await store.logoutHandler({ redirectTo: 'https://invest.example.com/signup' });

    expect(resetAllData).toHaveBeenCalled();
    expect(navigateWithQueryParams).toHaveBeenCalledWith('https://invest.example.com/signup');
    expect(redirectAfterLogout).not.toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'navigation-started' });
  });

  it('should handle auth flow error', async () => {
    const getAuthFlowState = ref({ error: 'Auth flow error', data: null });
    const getLogoutState = ref({ error: null, data: null });

    const mockAuthRepository = {
      getAuthFlow: vi.fn().mockResolvedValue({}),
      getLogout: vi.fn(),
      getAuthFlowState,
      getLogoutState,
    };

    (useRepositoryAuth as any).mockReturnValue(mockAuthRepository);

    const store = useLogoutStore();
    const outcome = await store.logoutHandler();

    expect(mockAuthRepository.getAuthFlow).toHaveBeenCalledWith(SELFSERVICE.logout);
    expect(mockAuthRepository.getLogout).not.toHaveBeenCalled();
    expect(store.isLoading).toBe(false);
    expect(outcome).toEqual({ status: 'failed' });
  });

  it('should handle logout state error', async () => {
    const getAuthFlowState = ref({ error: null, data: { logout_token: 'test-token' } });
    const getLogoutState = ref({ error: 'Logout error', data: null });

    const mockAuthRepository = {
      getAuthFlow: vi.fn().mockResolvedValue({}),
      getLogout: vi.fn().mockResolvedValue({}),
      getAuthFlowState,
      getLogoutState,
    };

    (useRepositoryAuth as any).mockReturnValue(mockAuthRepository);

    const store = useLogoutStore();
    const outcome = await store.logoutHandler();

    expect(mockAuthRepository.getAuthFlow).toHaveBeenCalledWith(SELFSERVICE.logout);
    expect(mockAuthRepository.getLogout).toHaveBeenCalledWith('test-token');
    expect(redirectAfterLogout).not.toHaveBeenCalled();
    expect(resetAllData).not.toHaveBeenCalled();
    expect(store.isLoading).toBe(false);
    expect(outcome).toEqual({ status: 'failed' });
  });

  it('returns failed when private-state reset rejects', async () => {
    const getAuthFlowState = ref({ error: null, data: { logout_token: 'test-token' } });
    const getLogoutState = ref({ error: null, data: null });
    (useRepositoryAuth as any).mockReturnValue({
      getAuthFlow: vi.fn().mockResolvedValue({}),
      getLogout: vi.fn().mockResolvedValue({}),
      getAuthFlowState,
      getLogoutState,
    });
    vi.mocked(resetAllData).mockRejectedValueOnce(new Error('reset failed'));

    const outcome = await useLogoutStore().logoutHandler();

    expect(outcome).toEqual({ status: 'failed' });
    expect(mockGlobalLoaderHide).toHaveBeenCalledOnce();
  });

  it('returns failed when navigation initiation throws', async () => {
    const getAuthFlowState = ref({ error: null, data: { logout_token: 'test-token' } });
    const getLogoutState = ref({ error: null, data: null });
    (useRepositoryAuth as any).mockReturnValue({
      getAuthFlow: vi.fn().mockResolvedValue({}),
      getLogout: vi.fn().mockResolvedValue({}),
      getAuthFlowState,
      getLogoutState,
    });
    vi.mocked(navigateWithQueryParams).mockImplementationOnce(() => {
      throw new Error('navigation failed');
    });

    const outcome = await useLogoutStore().logoutHandler({ redirectTo: '/signup?invite=one' });

    expect(outcome).toEqual({ status: 'failed' });
    expect(mockGlobalLoaderHide).toHaveBeenCalledOnce();
  });
});
