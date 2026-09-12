import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCookies } from '@vueuse/integrations/useCookies';
import type { InvestAppConfig } from '@webdevelop-pro/invest-core/app/config';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import {
  resetInvestRuntimeConfigForTests,
  setInvestRuntimeConfig,
} from '../../../config';

// Mock useCookies
vi.mock('@vueuse/integrations/useCookies', () => ({
  useCookies: vi.fn(),
}));

const createMockSession = (active: boolean) => ({
  active,
  expires_at: '2024-12-31T23:59:59Z',
});

const runtimeConfig: InvestAppConfig = {
  env: 'test',
  isDev: true,
  isStaticSite: false,
  enableAnalytics: false,
  cookieDomain: '',
  urls: {
    frontend: 'https://app.example.test',
    dashboard: 'https://dashboard.example.test',
    static: 'https://static.example.test',
    api: {
      user: 'https://user.example.test',
      offer: 'https://offer.example.test',
      investment: 'https://investment.example.test',
      wallet: 'https://wallet.example.test',
      evm: 'https://evm.example.test',
      filer: 'https://filer.example.test',
      distributions: 'https://distributions.example.test',
      accreditation: 'https://accreditation.example.test',
      kratos: 'https://kratos.example.test',
    },
  },
  brand: { title: 'Test', description: 'Test' },
  thirdParty: {},
};

describe('useSession', () => {
  let cookies: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    setActivePinia(createPinia());
    setInvestRuntimeConfig(runtimeConfig);
    vi.clearAllMocks();

    cookies = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    (useCookies as any).mockReturnValue(cookies);
  });

  afterEach(() => {
    resetInvestRuntimeConfigForTests();
  });

  describe('initial state', () => {
    it('should initialize with undefined session when no cookie exists', () => {
      cookies.get.mockReturnValue(undefined);

      const store = useSessionStore();
      expect(store.userSession).toBeUndefined();
      expect(store.userLoggedIn).toBe(false);
      expect(store.isSessionHydrated).toBe(false);
    });

    it('should not read session from cookie until hydration sync runs', () => {
      const mockSession = createMockSession(true);
      cookies.get.mockReturnValue(mockSession);

      const store = useSessionStore();
      expect(store.userSession).toBeUndefined();
      expect(store.userLoggedIn).toBe(false);
      expect(store.isSessionHydrated).toBe(false);
    });
  });

  describe('syncSessionFromCookies', () => {
    it('should read session from cookies and mark session as hydrated', () => {
      const mockSession = createMockSession(true);
      cookies.get.mockReturnValue(mockSession);

      const store = useSessionStore();
      store.syncSessionFromCookies();

      expect(store.userSession).toEqual(mockSession);
      expect(store.userLoggedIn).toBe(true);
      expect(store.isSessionHydrated).toBe(true);
    });
  });

  describe('updateSession', () => {
    it('should update session and set cookie', () => {
      const store = useSessionStore();
      const newSession = createMockSession(true);

      store.updateSession(newSession);

      expect(store.userSession).toEqual(newSession);
      expect(store.isSessionHydrated).toBe(true);
      expect(cookies.set).toHaveBeenCalledWith(
        'session',
        newSession,
        expect.any(Object),
      );
    });

    it('omits cookie expiry when the session expiry is missing or malformed', () => {
      const store = useSessionStore();
      const sessionWithoutExpiry = createMockSession(true) as ReturnType<typeof createMockSession> & {
        expires_at?: string;
      };
      delete sessionWithoutExpiry.expires_at;

      store.updateSession(sessionWithoutExpiry as never);

      expect(cookies.set).toHaveBeenCalledWith(
        'session',
        sessionWithoutExpiry,
        expect.not.objectContaining({ expires: expect.anything() }),
      );
    });
  });

  describe('resetAll', () => {
    it('should clear session and remove cookie', () => {
      const store = useSessionStore();
      store.resetAll();

      expect(store.userSession).toBeUndefined();
      expect(store.isSessionHydrated).toBe(true);
      expect(cookies.remove).toHaveBeenCalledWith('session', expect.any(Object));
    });
  });

  describe('userLoggedIn computed', () => {
    it('should return true when session is active', () => {
      const mockSession = createMockSession(true);
      cookies.get.mockReturnValue(mockSession);

      const store = useSessionStore();
      store.syncSessionFromCookies();
      expect(store.userLoggedIn).toBe(true);
    });

    it('should return false when session is inactive', () => {
      const mockSession = createMockSession(false);
      cookies.get.mockReturnValue(mockSession);

      const store = useSessionStore();
      store.syncSessionFromCookies();
      expect(store.userLoggedIn).toBe(false);
    });

    it('should return false when session is undefined', () => {
      cookies.get.mockReturnValue(undefined);

      const store = useSessionStore();
      expect(store.userLoggedIn).toBe(false);
    });
  });
});
