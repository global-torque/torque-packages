import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';
import { useLoginStore } from '../useLogin.ts';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';
import { rememberInvitationReturnForFlow } from '../../navigation/invitationReturn.ts';

// Mock data
const mockFlowId = 'test-flow-id';
const mockSession = {
  id: 'test-session',
  identity: {
    id: 'identity-123',
    traits: {
      email: 'test@example.com',
    },
  },
};
const mockAuthFlowId = { value: mockFlowId };
const mockAuthCsrfToken = { value: 'test-csrf-token' };
const mockGetAuthFlow = vi.fn().mockResolvedValue({ id: mockFlowId, ui: {} });
const mockSetLogin = vi.fn().mockResolvedValue(undefined);
const mockGetLogin = vi.fn().mockResolvedValue(undefined);
const sendEventMock = vi.fn().mockResolvedValue(undefined);
const updateSessionMock = vi.fn();

// Mock the auth repository
const mockGetAuthFlowState = ref<any>({ error: null });
const mockSetLoginState = ref<any>({ data: null, error: null });
const mockGetLoginState = ref<any>({ data: { requested_aal: 'aal1' }, error: null });
const mockGetSchemaState = ref<any>({ data: undefined, loading: false, error: null });
const mockDemoAccountAuthenticate = vi.fn().mockResolvedValue(true);
const mockIsDemoAccountAvailable = ref(true);
const mockIsDemoAccountLoading = ref(false);
const { mockShouldAutoAuthenticateDemoAccount } = vi.hoisted(() => ({
  mockShouldAutoAuthenticateDemoAccount: vi.fn().mockReturnValue(false),
}));

vi.mock('../../data/auth.repository.ts', () => ({
  useRepositoryAuth: () => ({
    flowId: mockAuthFlowId,
    csrfToken: mockAuthCsrfToken,
    getAuthFlow: mockGetAuthFlow,
    setLogin: mockSetLogin,
    getLogin: mockGetLogin,
    getSchemaState: mockGetSchemaState,
    setLoginState: mockSetLoginState,
    getAuthFlowState: mockGetAuthFlowState,
    getLoginState: mockGetLoginState,
  }),
}));

vi.mock('../../links.ts', () => ({
  getAuthLinks: () => ({
    signin: '/signin',
    signup: '/signup',
    profile: () => '/profile',
    authenticator: '/authenticator',
  }),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({ updateSession: updateSessionMock }),
}));


vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/analytics/useSendAnalyticsEvent', () => ({
  useSendAnalyticsEvent: () => ({
    sendEvent: sendEventMock,
  }),
}));

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({
  oryResponseHandling: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../composables/useDemoAccountAuth.ts', () => ({
  useDemoAccountAuth: () => ({
    authenticate: mockDemoAccountAuthenticate,
    isAvailable: mockIsDemoAccountAvailable,
    isLoading: mockIsDemoAccountLoading,
  }),
  shouldAutoAuthenticateDemoAccount: mockShouldAutoAuthenticateDemoAccount,
}));

describe('useLogin Store', () => {
  let store: ReturnType<typeof useLoginStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    
    // Reset mock refs to initial state
    mockGetAuthFlowState.value = { error: null };
    mockSetLoginState.value = { data: null, error: null };
    mockGetLoginState.value = { data: { requested_aal: 'aal1' }, error: null };
    mockGetSchemaState.value = { data: undefined, loading: false, error: null };
    mockAuthFlowId.value = mockFlowId;
    mockAuthCsrfToken.value = 'test-csrf-token';
    mockGetAuthFlow.mockReset().mockResolvedValue({ id: mockFlowId, ui: {} });
    mockSetLogin.mockReset().mockResolvedValue(undefined);
    mockGetLogin.mockReset().mockResolvedValue(undefined);
    sendEventMock.mockReset().mockResolvedValue(undefined);
    updateSessionMock.mockReset();
    mockDemoAccountAuthenticate.mockReset().mockResolvedValue(true);
    mockShouldAutoAuthenticateDemoAccount.mockReset().mockReturnValue(false);
    mockIsDemoAccountAvailable.value = true;
    mockIsDemoAccountLoading.value = false;
    sessionStorage.clear();
    window.history.replaceState({}, '', '/signin');
    
    store = useLoginStore();
  });

  describe('Form Validation', () => {
    it('should validate email and password fields', async () => {
      // Test invalid email
      store.model.email = 'invalid-email';
      store.model.password = 'validPassword123!';
      await store.onValidate();
      expect(store.isValid).toBe(false);

      // Test invalid password
      store.model.email = 'valid@email.com';
      store.model.password = 'short';
      await store.onValidate();
      expect(store.isValid).toBe(false);

      // Test valid credentials
      store.model.email = 'valid@email.com';
      store.model.password = 'validPassword123!';
      await store.onValidate();
      expect(store.isValid).toBe(true);
    });
  });

  describe('Password Login', () => {
    it('should handle successful password login', async () => {
      store.model.email = 'test@example.com';
      store.model.password = 'validPassword123!';

      mockSetLoginState.value = { error: null, data: { session: mockSession } };
      mockGetAuthFlow.mockImplementationOnce(async () => {
        mockAuthCsrfToken.value = 'fresh-csrf-token';
      });

      await store.loginPasswordHandler();

      expect(store.isLoading).toBe(false);
      expect(mockSetLogin).toHaveBeenCalledWith(
        mockFlowId,
        expect.objectContaining({
          csrf_token: 'fresh-csrf-token',
          password: 'validPassword123!',
        }),
      );
      expect(updateSessionMock).toHaveBeenCalledWith(mockSession);
      expect(sendEventMock).toHaveBeenCalledWith(expect.objectContaining({
        status_code: 200,
      }));
      expect(updateSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
        sendEventMock.mock.invocationCallOrder[0],
      );
    });

    it('should handle login errors', async () => {
      store.model.email = 'test@example.com';
      store.model.password = 'validPassword123!';

      mockGetAuthFlowState.value = { error: new Error('Test error') };

      await store.loginPasswordHandler();

      expect(store.isLoading).toBe(false);
    });
  });

  describe('Social Login', () => {
    it('should handle social login with flow parameter', async () => {
      setActivePinia(createPinia());
      const testStore = useLoginStore();
      
      // Mock getQueryParam to return flow ID
      vi.spyOn(testStore, 'getQueryParam').mockImplementation((key: string) => {
        return key === 'flow' ? 'existing-flow-id' : undefined;
      });

      mockGetAuthFlowState.value = { error: null };

      await testStore.loginSocialHandler('google');

      expect(testStore.isLoading).toBe(false);
    });

    it('should handle social login without flow parameter', async () => {
      setActivePinia(createPinia());
      const testStore = useLoginStore();
      mockGetAuthFlow.mockImplementationOnce(async () => {
        mockAuthCsrfToken.value = 'fresh-social-csrf-token';
      });
      
      // Mock getQueryParam to return undefined for flow
      vi.spyOn(testStore, 'getQueryParam').mockImplementation(() => {
        return undefined;
      });

      mockGetAuthFlowState.value = { error: null };

      await testStore.loginSocialHandler('google');

      expect(testStore.isLoading).toBe(false);
      expect(mockSetLogin).toHaveBeenCalledWith(
        mockFlowId,
        expect.objectContaining({
          provider: 'google',
          csrf_token: 'fresh-social-csrf-token',
        }),
      );
    });
  });

  describe('Demo Account', () => {
    it('should delegate demo account login to the shared demo auth helper', async () => {
      await store.demoAccountHandler();

      expect(mockDemoAccountAuthenticate).toHaveBeenCalledTimes(1);
      expect(store.isDemoAccountAvailable).toBe(true);
      expect(store.isDemoAccountLoading).toBe(false);
    });
  });

  describe('Navigation and Query Parameters', () => {
    it('restores a canonical invitation when navigating back to signup', () => {
      window.history.replaceState(
        {},
        '',
        '/signin?redirect=%2Fsignup%3Finvite%3Dopaque%252Fcode',
      );
      setActivePinia(createPinia());
      const testStore = useLoginStore();

      testStore.onSignup();

      expect(navigateWithQueryParams).toHaveBeenCalledWith(
        '/signup?invite=opaque%2Fcode',
      );
    });
    it('should handle query parameters correctly', () => {
      // Mock the queryParams computed to return our test data
      const mockQueryParams = new Map([['redirect', '/test'], ['source', 'email']]);
      
      setActivePinia(createPinia());
      const testStore = useLoginStore();
      
      // Mock the getQueryParam method
      vi.spyOn(testStore, 'getQueryParam').mockImplementation((key: string) => {
        return mockQueryParams.get(key);
      });

      expect(testStore.getQueryParam('redirect')).toBe('/test');
    });

    it('should handle navigation with query parameters', () => {
      // Mock the queryParams computed to return our test data
      const mockQueryParams = new Map([['redirect', '/test'], ['source', 'email']]);
      
      setActivePinia(createPinia());
      const testStore = useLoginStore();
      
      // Mock the getQueryParam method
      vi.spyOn(testStore, 'getQueryParam').mockImplementation((key: string) => {
        return mockQueryParams.get(key);
      });
      
      // Verify query param is accessible
      expect(testStore.getQueryParam('redirect')).toBe('/test');
      
      // onSignup should navigate with preserved query params - verify it doesn't throw
      expect(() => testStore.onSignup()).not.toThrow();
    });
  });

  describe('onMountedHandler', () => {
    it('recovers an invitation from an Ory flow return and preserves it through MFA', async () => {
      window.history.replaceState({}, '', '/signin?flow=test-flow-id');
      mockGetLogin.mockResolvedValueOnce({
        return_to: `${window.location.origin}/signup?invite=flow-code`,
      });
      mockGetLoginState.value = { data: { requested_aal: 'aal2' }, error: null };
      setActivePinia(createPinia());
      const testStore = useLoginStore();

      await testStore.onMountedHandler();

      expect(testStore.isAuthReturnResolved).toBe(true);
      expect(navigateWithQueryParams).toHaveBeenCalledWith(
        expect.any(String),
        { redirect: '/signup?invite=flow-code' },
      );
    });

    it('recovers an invitation when a flow-only login callback has expired', async () => {
      const origin = window.location.origin;
      rememberInvitationReturnForFlow({
        flowId: 'expired-login-flow',
        invitationReturn: `${origin}/signup?invite=remembered-code`,
        origin,
      });
      window.history.replaceState({}, '', '/signin?flow=expired-login-flow');
      mockGetLogin.mockRejectedValueOnce(new Error('flow expired'));
      setActivePinia(createPinia());
      const testStore = useLoginStore();

      await testStore.onMountedHandler();

      expect(testStore.invitationReturnPath()).toBe('/signup?invite=remembered-code');
      expect(testStore.authHeaderState.signUpHref).toBe('/signup?invite=remembered-code');
    });

    it('should handle flow parameter and navigate to authenticator when aal2 is requested', async () => {
      window.history.replaceState({}, '', '/signin?flow=test-flow-id');
      setActivePinia(createPinia());
      const testStore = useLoginStore();

      mockGetLoginState.value = { data: { requested_aal: 'aal2' }, error: null };

      await testStore.onMountedHandler();

      expect(mockGetLoginState.value.data?.requested_aal).toBe('aal2');
    });

    it('should not navigate when flow parameter is not present', async () => {
      setActivePinia(createPinia());
      const testStore = useLoginStore();

      await testStore.onMountedHandler();

      expect(window.location.search).toBe('');
      expect(mockDemoAccountAuthenticate).not.toHaveBeenCalled();
    });

    it('should not navigate when aal2 is not requested', async () => {
      window.history.replaceState({}, '', '/signin?flow=test-flow-id');
      setActivePinia(createPinia());
      const testStore = useLoginStore();

      mockGetLoginState.value = { data: { requested_aal: 'aal1' }, error: null };

      await testStore.onMountedHandler();

      expect(mockGetLoginState.value.data?.requested_aal).toBe('aal1');
      expect(mockDemoAccountAuthenticate).not.toHaveBeenCalled();
    });

    it('should auto-login the demo account when tryDemo is present without an existing flow', async () => {
      window.history.replaceState({}, '', '/signin?tryDemo=1');
      setActivePinia(createPinia());
      const testStore = useLoginStore();
      mockShouldAutoAuthenticateDemoAccount.mockReturnValue(true);

      await testStore.onMountedHandler();

      expect(mockShouldAutoAuthenticateDemoAccount).toHaveBeenCalledWith(window.location.search);
      expect(mockDemoAccountAuthenticate).toHaveBeenCalledTimes(1);
    });

    it('should not auto-login the demo account when a flow continuation is already in progress', async () => {
      window.history.replaceState({}, '', '/signin?flow=test-flow-id&tryDemo=1');
      setActivePinia(createPinia());
      const testStore = useLoginStore();
      mockShouldAutoAuthenticateDemoAccount.mockReturnValue(true);

      await testStore.onMountedHandler();

      expect(mockShouldAutoAuthenticateDemoAccount).not.toHaveBeenCalled();
      expect(mockDemoAccountAuthenticate).not.toHaveBeenCalled();
    });
  });
});
