import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRepositoryAuth } from '../../data/auth.repository.ts';
import { ref } from 'vue';
import { useForgotStore } from '../useForgot.ts';

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

vi.mock('@webdevelop-pro/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn(),
}));

vi.mock('../../links.ts', () => ({
  getAuthLinks: () => ({ checkEmail: '/check-email' }),
}));

vi.mock('@webdevelop-pro/invest-runtime/error/oryResponseHandling', () => ({ oryResponseHandling: vi.fn() }));
vi.mock('@webdevelop-pro/invest-runtime/error/oryErrorHandling', () => ({ oryErrorHandling: vi.fn().mockResolvedValue(undefined) }));

describe('useForgot Store', () => {
  let store: ReturnType<typeof useForgotStore>;
  let mockAuthRepository: ReturnType<typeof useRepositoryAuth>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    store = useForgotStore();
    mockAuthRepository = useRepositoryAuth();
  });

  describe('Form Validation', () => {
    it('should validate email format correctly', async () => {
      // Test invalid email
      store.model.email = 'invalid-email';
      await store.onValidate();
      expect(store.isValid).toBe(false);

      // Test valid email
      store.model.email = 'test@example.com';
      await store.onValidate();
      expect(store.isValid).toBe(true);
    });

    it('should handle form validation with backend schema', async () => {
      // Mock backend schema
      const backendSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
        required: ['email'],
      };

      mockAuthRepository.getSchemaState.value = { data: backendSchema };

      // Test with invalid data
      store.model.email = 'invalid';
      await store.onValidate();
      expect(store.isValid).toBe(false);

      // Test with valid data
      store.model.email = 'valid@example.com';
      await store.onValidate();
      expect(store.isValid).toBe(true);
    });

    it('should disable button when form is invalid or loading', async () => {
      // Initially should be disabled due to invalid form
      store.model.email = '';
      await store.onValidate();
      expect(store.isDisabledButton).toBe(true);

      // Set valid email
      store.model.email = 'test@example.com';
      await store.onValidate();
      expect(store.isDisabledButton).toBe(false);

      // Set loading state
      store.isLoading = true;
      expect(store.isDisabledButton).toBe(true);
    });
  });

  describe('Recovery Handler', () => {
    it('should not proceed if form validation fails', async () => {
      store.model.email = 'invalid-email';
      await store.recoveryHandler();

      expect(mockAuthRepository.getAuthFlow).not.toHaveBeenCalled();
      expect(store.isLoading).toBe(false);
    });

    it('should handle successful recovery flow', async () => {
      store.model.email = 'test@example.com';

      // Mock successful recovery
      mockAuthRepository.setRecoveryState.value = {
        data: { state: 'sent_email' },
        error: null,
      };

      await store.recoveryHandler();

      expect(mockAuthRepository.getAuthFlow).toHaveBeenCalledWith('/self-service/recovery/browser');
      expect(mockAuthRepository.setRecovery).toHaveBeenCalledWith('test-flow-id', {
        email: 'test@example.com',
        method: 'code',
        csrf_token: 'test-csrf-token',
      });
      expect(store.isLoading).toBe(false);
    });

    it('should handle auth flow error', async () => {
      store.model.email = 'test@example.com';

      // Mock auth flow error
      mockAuthRepository.getAuthFlowState.value = { error: 'Auth flow error' };

      await store.recoveryHandler();

      expect(mockAuthRepository.getAuthFlow).toHaveBeenCalled();
      expect(store.isLoading).toBe(false);
    });

    it('should handle recovery error', async () => {
      store.model.email = 'test@example.com';

      // Mock recovery error
      mockAuthRepository.setRecoveryState.value = {
        data: null,
        error: 'Recovery error',
      };

      await store.recoveryHandler();

      expect(mockAuthRepository.getAuthFlow).toHaveBeenCalled();
      expect(mockAuthRepository.setRecovery).toHaveBeenCalled();
      expect(store.isLoading).toBe(false);
    });
  });
});
