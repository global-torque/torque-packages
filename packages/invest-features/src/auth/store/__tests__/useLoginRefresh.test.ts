import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRepositoryAuth } from '../../data/auth.repository.ts';
import { reactive, ref } from 'vue';
import { SELFSERVICE } from '@global-torque/domain-types/authConstants';
import { useLoginRefreshStore } from '../useLoginRefresh.ts';

// Add at the top of your file, before vi.mock:
export const mockUpdateSession = vi.fn();
const mockFlowId = { value: 'test-flow-id' };
const mockCsrfToken = { value: 'test-csrf-token' };
const mockGetAuthFlow = vi.fn().mockResolvedValue({ id: 'test-flow-id', ui: {} });
const mockSetLogin = vi.fn().mockResolvedValue(undefined);
const mockGetSchemaState = ref({ data: undefined, loading: false, error: null });
const mockSetLoginState = ref({ data: null, error: null });
const mockGetAuthFlowState = ref({ error: null });
const sendEventMock = vi.fn().mockResolvedValue(undefined);

// Mock all required dependencies
vi.mock('../../data/auth.repository.ts', () => {
  return {
    useRepositoryAuth: vi.fn(() => ({
      flowId: mockFlowId,
      csrfToken: mockCsrfToken,
      getAuthFlow: mockGetAuthFlow,
      setLogin: mockSetLogin,
      getSchemaState: mockGetSchemaState,
      setLoginState: mockSetLoginState,
      getAuthFlowState: mockGetAuthFlowState,
    })),
  };
});

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({ oryResponseHandling: vi.fn() }));
vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@global-torque/invest-runtime/analytics/useSendAnalyticsEvent', () => ({
  useSendAnalyticsEvent: () => ({
    sendEvent: sendEventMock,
  }),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: vi.fn(() => ({
    updateSession: mockUpdateSession,
  })),
}));

vi.mock('@global-torque/ui-kit/form-validation', () => ({
  useFormValidation: vi.fn(() => {
    const model = reactive({ email: '', password: '' });
    const isValid = ref(true);
    const validation = ref({});

    const onValidate = vi.fn().mockImplementation(() => {
      // Simple validation logic for testing
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(model.email);
      const passwordValid = model.password.length >= 8;

      isValid.value = emailValid && passwordValid;
      validation.value = {
        email: !emailValid ? ['Invalid email format'] : [],
        password: !passwordValid ? ['Password must be at least 8 characters'] : [],
      };
    });

    return {
      model,
      validation,
      isValid,
      onValidate,
      scrollToError: vi.fn(),
      formErrors: ref({}),
      isFieldRequired: vi.fn(),
      getErrorText: vi.fn(),
      getOptions: vi.fn(),
      getReferenceType: vi.fn(),
      resetValidation: vi.fn(),
      schemaObject: ref({}),
    } as any;
  }),
}));

vi.mock('@global-torque/invest-runtime/dialogs', () => ({
  useDialogs: vi.fn(() => ({
    isDialogRefreshSessionOpen: ref(false),
    completeSessionRefresh: vi.fn(),
  })),
}));

describe('useLoginRefresh Store', () => {
  let store: ReturnType<typeof useLoginRefreshStore>;
  let mockAuthRepository: ReturnType<typeof useRepositoryAuth>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockFlowId.value = 'test-flow-id';
    mockCsrfToken.value = 'test-csrf-token';
    mockGetAuthFlow.mockReset().mockResolvedValue({ id: 'test-flow-id', ui: {} });
    mockSetLogin.mockReset().mockResolvedValue(undefined);
    mockGetSchemaState.value = { data: undefined, loading: false, error: null };
    mockSetLoginState.value = { data: null, error: null };
    mockGetAuthFlowState.value = { error: null };
    sendEventMock.mockReset().mockResolvedValue(undefined);

    store = useLoginRefreshStore();
    mockAuthRepository = useRepositoryAuth();
  });

  describe('Form Validation', () => {
    it('should validate email and password fields', async () => {
      const store = useLoginRefreshStore();

      // Test invalid email
      store.model.email = 'invalid-email';
      store.model.password = 'validPassword123!';
      await store.onValidate();
      expect(store.isValid).toBe(false);
      expect(store.validation.email.length).toBeGreaterThan(0);

      // Test invalid password
      store.model.email = 'valid@email.com';
      store.model.password = 'short';
      await store.onValidate();
      expect(store.isValid).toBe(false);
      expect(store.validation.password.length).toBeGreaterThan(0);

      // Test valid credentials
      store.model.email = 'valid@email.com';
      store.model.password = 'validPassword123!';
      await store.onValidate();
      expect(store.isValid).toBe(true);
      expect(store.validation.email.length).toBe(0);
      expect(store.validation.password.length).toBe(0);
    });

    it('should handle form validation with backend schema', async () => {
      const store = useLoginRefreshStore();

      // Mock backend schema
      const backendSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
        required: ['email', 'password'],
      };

      useRepositoryAuth().getSchemaState.value = { data: backendSchema };

      // Test with invalid data
      store.model.email = 'invalid';
      store.model.password = '123';
      await store.onValidate();
      expect(store.isValid).toBe(false);

      // Test with valid data
      store.model.email = 'valid@example.com';
      store.model.password = 'validPassword123!';
      await store.onValidate();
      expect(store.isValid).toBe(true);
    });
  });

  describe('Password Login', () => {
    it('should handle successful password login', async () => {
      const store = useLoginRefreshStore();
      store.model.email = 'test@example.com';
      store.model.password = 'validPassword123!';

      const mockSession = {
        id: 'test-session',
        identity: {
          id: 'identity-789',
          traits: {
            email: 'test@example.com',
          },
        },
      };
      mockGetAuthFlow.mockImplementationOnce(async () => {
        mockCsrfToken.value = 'fresh-refresh-csrf-token';
      });
      mockSetLoginState.value = { error: null, data: { session: mockSession } };

      await store.loginPasswordHandler();
      expect(store.isLoading).toBe(false);
      expect(mockSetLogin).toHaveBeenCalledWith(
        'test-flow-id',
        expect.objectContaining({
          csrf_token: 'fresh-refresh-csrf-token',
          password: 'validPassword123!',
        }),
      );
      expect(mockUpdateSession).toHaveBeenCalledWith(mockSession);
      expect(sendEventMock).toHaveBeenCalledWith(expect.objectContaining({
        status_code: 200,
      }));
      expect(mockUpdateSession.mock.invocationCallOrder[0]).toBeLessThan(
        sendEventMock.mock.invocationCallOrder[0],
      );
    });

    it('should handle login errors', async () => {
      const store = useLoginRefreshStore();
      store.model.email = 'test@example.com';
      store.model.password = 'validPassword123!';

      mockGetAuthFlowState.value = { error: 'Test error' };

      await store.loginPasswordHandler();
      expect(store.isLoading).toBe(false);
    });
  });

  describe('Social Login', () => {
    it('should handle social login with existing flow ID', async () => {
      // Mock URL with flow parameter
      Object.defineProperty(window, 'location', {
        value: { search: '?flow=existing-flow-id' },
        writable: true,
      });

      await store.loginSocialHandler('google');

      expect(mockAuthRepository.setLogin).toHaveBeenCalledWith(
        'existing-flow-id',
        expect.objectContaining({
          provider: 'google',
          method: 'oidc',
          csrf_token: 'test-csrf-token',
        }),
      );
      expect(store.isLoading).toBe(false);
    });

    it('should handle social login without flow ID', async () => {
      // Mock URL without flow parameter
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });
      mockGetAuthFlow.mockImplementationOnce(async () => {
        mockCsrfToken.value = 'fresh-refresh-social-token';
      });

      await store.loginSocialHandler('google');

      expect(mockAuthRepository.getAuthFlow).toHaveBeenCalledWith(SELFSERVICE.login, { refresh: true });
      expect(mockAuthRepository.setLogin).toHaveBeenCalledWith(
        'test-flow-id',
        expect.objectContaining({
          provider: 'google',
          method: 'oidc',
          csrf_token: 'fresh-refresh-social-token',
        }),
      );
      expect(store.isLoading).toBe(false);
    });
  });

  describe('Query Parameters', () => {
    it('should handle query parameters correctly', () => {
      // Mock URL with multiple query parameters
      Object.defineProperty(window, 'location', {
        value: { search: '?redirect=/test&source=email' },
        writable: true,
      });

      expect(store.getQueryParam('redirect')).toBe('/test');
      expect(store.getQueryParam('source')).toBe('email');
    });

    it('should return undefined for non-existent query parameters', () => {
      // Mock URL with no query parameters
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });

      expect(store.getQueryParam('nonexistent')).toBeUndefined();
    });
  });
});
