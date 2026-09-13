import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRepositoryAuth } from '../../data/auth.repository.ts';
import { ref, reactive, watch } from 'vue';
// useToast will be mocked below; no direct import to avoid alias/type issues
import { useVerificationStore } from '../useVerification.ts';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';

// Mock all required dependencies
vi.mock('../../data/auth.repository.ts', () => {
  const mockGetAuthFlow = vi.fn().mockResolvedValue({ id: 'test-flow-id', ui: {} });
  const mockSetRecovery = vi.fn().mockResolvedValue(undefined);

  return {
    useRepositoryAuth: vi.fn(() => ({
      flowId: { value: 'test-flow-id' },
      csrfToken: { value: 'test-csrf-token' },
      getAuthFlow: mockGetAuthFlow,
      setRecovery: mockSetRecovery,
      getSchemaState: ref({ data: undefined, loading: false, error: null }),
      setRecoveryState: ref({ data: null, error: null }),
      getAuthFlowState: ref({ error: null }),
    })),
  };
});

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({ oryResponseHandling: vi.fn() }));
vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../links.ts', () => ({
  getAuthLinks: () => ({ resetPassword: '/reset-password' }),
}));

vi.mock('@global-torque/ui-kit/form-validation', () => ({
  useFormValidation: vi.fn(() => {
    const model = reactive({ code: '' });
    const isValid = ref(true);
    const validation = ref({});

    const onValidate = vi.fn().mockImplementation(() => {
      // Simple validation logic for testing
      const codeValid = /^\d{6}$/.test(model.code);

      isValid.value = codeValid;
      validation.value = {
        code: !codeValid ? ['Code must be 6 digits'] : [],
      };
    });

    // Watch for model changes
    watch(() => model, () => {
      if (!isValid.value) onValidate();
    }, { deep: true });

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

// No need to mock general scroll here; not asserted in tests

// Mock the dependencies
vi.mock('@global-torque/ui-primitives/sonner', () => ({
  // sonner's toast is a function with variant methods; all record on one mock
  get toast() { return Object.assign(vi.fn, { error: vi.fn, success: vi.fn, info: vi.fn, dismiss: vi.fn }); },
}));

describe('useVerification Store', () => {
  let store: ReturnType<typeof useVerificationStore>;
  let mockAuthRepository: ReturnType<typeof useRepositoryAuth>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Mock URL with query parameters
    Object.defineProperty(window, 'location', {
      value: { search: '?flowId=test-flow-id&email=test@example.com' },
      writable: true,
    });

    store = useVerificationStore();
    mockAuthRepository = useRepositoryAuth();
  });

  describe('Query Parameters', () => {
    it('should correctly parse query parameters', () => {
      expect(store.flowId).toBe('test-flow-id');
      expect(store.email).toBe('test@example.com');
    });

    it('should handle missing query parameters', () => {
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });

      const newStore = useVerificationStore();
      expect(newStore.flowId).toBeUndefined();
      expect(newStore.email).toBeUndefined();
    });
  });

  describe('Form Validation', () => {
    it('should validate verification code field', async () => {
      // Test invalid code
      store.model.code = '12345'; // Less than 6 digits
      await store.onValidate();
      expect(store.isValid).toBe(false);
      expect(store.validation.code.length).toBeGreaterThan(0);

      // Test valid code
      store.model.code = '123456';
      await store.onValidate();
      expect(store.isValid).toBe(true);
      expect(store.validation.code.length).toBe(0);
    });

    it('should handle form validation with backend schema', async () => {
      // Mock backend schema
      const backendSchema = { id: 'schema-id', schema: '{}', url: 'http://example.com/schema' } as any;
      (useRepositoryAuth() as any).getSchemaState.value = { data: backendSchema } as any;

      // Test with invalid data
      store.model.code = '12345';
      await store.onValidate();
      expect(store.isValid).toBe(false);

      // Test with valid data
      store.model.code = '123456';
      await store.onValidate();
      expect(store.isValid).toBe(true);
    });
  });

  describe('Verification Handler', () => {
    it('should handle successful verification', async () => {
      // Set up the model with a valid verification code
      store.model.code = '123456';
      await store.onValidate(); // Ensure validation is run
      store.setRecoveryState = { data: { id: 'id', type: 'browser', active: true, expires_at: '', issued_at: '', request_url: '', state: 'success', ui: { action: '', method: 'POST', nodes: [] }, messages: [], continue_with: [{ action: 'redirect_browser_to', redirect_browser_to: 'https://identity.example.test/settings?flow=recovery-settings-flow-id' }] } as any, error: null } as any;

      await store.verificationHandler();
      expect(store.isLoading).toBe(false);
      expect(mockAuthRepository.setRecovery).toHaveBeenCalledWith(
        'test-flow-id',
        expect.objectContaining({
          code: '123456',
          method: 'code',
          csrf_token: 'test-csrf-token',
        }),
      );
      expect(navigateWithQueryParams).toHaveBeenCalledWith(
        expect.stringContaining('/reset-password'),
        { flow: 'recovery-settings-flow-id' },
      );
    });

    it('fails closed when successful verification has no settings continuation', async () => {
      store.model.code = '123456';
      await store.onValidate();
      store.setRecoveryState = { data: { id: 'id', type: 'browser', active: true, expires_at: '', issued_at: '', request_url: '', state: 'success', ui: { action: '', method: 'POST', nodes: [] }, messages: [], continue_with: [] } as any, error: null } as any;

      await store.verificationHandler();

      expect(navigateWithQueryParams).not.toHaveBeenCalled();
    });

    it('should handle verification errors', async () => {
      store.model.code = '123456';
      await store.onValidate(); // Ensure validation is run
      store.setRecoveryState = { data: null as any, error: new Error('Verification failed') } as any;

      await store.verificationHandler();
      expect(store.isLoading).toBe(false);
      expect(navigateWithQueryParams).not.toHaveBeenCalled();
    });

    it('should not proceed with invalid form', async () => {
      store.model.code = '12345'; // Invalid code
      await store.onValidate(); // Ensure validation is run
      await store.verificationHandler();
      expect(mockAuthRepository.setRecovery).not.toHaveBeenCalled();
    });
  });
});
