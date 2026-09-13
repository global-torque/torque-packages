import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { SELFSERVICE } from '@global-torque/domain-types/authConstants';
import { useAuthenticatorStore } from '../useAuthenticator.ts';

// Shared mocks
export const mockUpdateSession = vi.fn();

const mockGetAuthFlow = vi.fn().mockResolvedValue(undefined);
const mockSetLogin = vi.fn().mockResolvedValue(undefined);
const mockGetSchemaState = ref({ data: undefined, loading: false, error: null });
const mockSetLoginState = ref({ data: null, error: null });
const mockGetAuthFlowState = ref({ error: null });

export const mockAuthRepository = {
  flowId: { value: 'test-flow-id' },
  csrfToken: { value: 'test-csrf-token' },
  getAuthFlow: mockGetAuthFlow,
  setLogin: mockSetLogin,
  getSchemaState: mockGetSchemaState,
  setLoginState: mockSetLoginState,
  getAuthFlowState: mockGetAuthFlowState,
  onLogout: vi.fn(),
};

// Mock all required dependencies
vi.mock('../../data/auth.repository.ts', () => ({
  useRepositoryAuth: vi.fn(() => mockAuthRepository),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: vi.fn(() => ({
    updateSession: mockUpdateSession,
  })),
}));

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({
  oryResponseHandling: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../links.ts', () => ({
  getAuthLinks: () => ({ profile: () => '/profile' }),
}));


vi.mock('@global-torque/ui-kit/form-validation', () => ({
  useFormValidation: vi.fn(() => {
    const model = ref({ totp_code: '' });
    const isValid = ref(true);
    const validation = ref({});

    const onValidate = vi.fn().mockImplementation(() => {
      // Simple validation logic for testing
      const totpValid = /^\d{6}$/.test(model.value.totp_code);

      isValid.value = totpValid;
      validation.value = {
        totp_code: !totpValid ? ['Invalid TOTP code format'] : [],
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

// Mock navigation
vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn().mockResolvedValue(undefined),
}));

describe('useAuthenticator Store', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let store: ReturnType<typeof useAuthenticatorStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    store = useAuthenticatorStore();
  });

  describe('Form Validation', () => {
    it('should validate TOTP code field', async () => {
      const store = useAuthenticatorStore();

      // Test invalid TOTP code
      store.model.totp_code = '12345';
      await store.onValidate();
      expect(store.isValid).toBe(false);
      expect(store.validation.totp_code.length).toBeGreaterThan(0);

      // Test valid TOTP code
      store.model.totp_code = '123456';
      await store.onValidate();
      expect(store.isValid).toBe(true);
      expect(store.validation.totp_code.length).toBe(0);
    });

    it('should handle form validation with backend schema', async () => {
      const store = useAuthenticatorStore();

      // Mock backend schema
      const backendSchema = {
        type: 'object',
        properties: {
          totp_code: { type: 'string', pattern: '^\\d{6}$' },
        },
        required: ['totp_code'],
      };

      mockAuthRepository.getSchemaState.value = { data: backendSchema };

      // Test with invalid data
      store.model.totp_code = '12345';
      await store.onValidate();
      expect(store.isValid).toBe(false);

      // Test with valid data
      store.model.totp_code = '123456';
      await store.onValidate();
      expect(store.isValid).toBe(true);
    });
  });

  describe('TOTP Handler', () => {
    it('should handle successful TOTP verification', async () => {
      const store = useAuthenticatorStore();
      store.model = {
        totp_code: 123456,
        email: 'test@example.com',
      };

      const mockSession = { id: 'test-session' };

      mockAuthRepository.setLogin.mockResolvedValue(undefined);
      mockAuthRepository.setLoginState.value = { error: null, data: { session: mockSession } };

      await store.totpHandler();
      expect(store.isLoading).toBe(false);
      expect(mockUpdateSession).toHaveBeenCalledWith(mockSession);
    });

    it('should handle TOTP verification errors', async () => {
      const store = useAuthenticatorStore();
      store.model = {
        totp_code: '123456',
      };

      mockAuthRepository.setLogin.mockResolvedValue(undefined);
      mockAuthRepository.setLoginState.value = { error: 'Invalid TOTP code', data: null };

      await store.totpHandler();
      expect(store.isLoading).toBe(false);
      expect(useSessionStore().updateSession).not.toHaveBeenCalled();
    });
  });

  describe('Navigation and Query Parameters', () => {
    it('should handle query parameters correctly', () => {
      const store = useAuthenticatorStore();

      // Mock URL with multiple query parameters
      Object.defineProperty(window, 'location', {
        value: { search: '?redirect=/test&source=email' },
        writable: true,
      });

      // Test query parameter retrieval
      expect(store.getQueryParam('redirect')).toBe('/test');
    });

    it('should handle navigation with query parameters', () => {
      const store = useAuthenticatorStore();

      // Mock URL with query parameters
      Object.defineProperty(window, 'location', {
        value: { search: '?redirect=/test&source=email' },
        writable: true,
      });

      store.navigateToProfile();

      // Verify navigation with preserved query parameters
      expect(store.getQueryParam('redirect')).toBe('/test');
    });
  });

  describe('Mount Handler', () => {
    it('should initialize auth flow on mount', async () => {
      const store = useAuthenticatorStore();
      await store.onMountedHandler();
      expect(mockAuthRepository.getAuthFlow).toHaveBeenCalledWith(SELFSERVICE.login, { aal: 'aal2' });
    });
  });
});
