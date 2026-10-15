import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRepositoryAuth } from '../../data/auth.repository.ts';
import { reactive, ref } from 'vue';
import { useLoginRefreshStore } from '../useLoginRefresh.ts';

export const mockUpdateSession = vi.fn();
const mockFlowId = { value: 'test-flow-id' };
const mockCsrfToken = { value: 'test-csrf-token' };
const mockGetAuthFlow = vi.fn().mockResolvedValue({ id: 'test-flow-id', ui: {} });
const mockSetLogin = vi.fn().mockResolvedValue(undefined);
const mockGetSchemaState = ref({
  data: undefined,
  loading: false,
  error: null,
});
const mockSetLoginState = ref({ data: null, error: null });
const mockGetAuthFlowState = ref({ error: null });
const sendEventMock = vi.fn().mockResolvedValue(undefined);
const { mockOryErrorHandling } = vi.hoisted(() => ({
  mockOryErrorHandling: vi.fn().mockResolvedValue(undefined),
}));
const mockCompleteSessionRefresh = vi.fn();
const mockSession = ref({
  active: true,
  identity: {
    id: 'identity-123',
    traits: { email: 'session@example.com' },
  },
});

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

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({
  oryResponseHandling: vi.fn(),
}));
vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: mockOryErrorHandling,
}));
vi.mock('@global-torque/invest-runtime/analytics/useSendAnalyticsEvent', () => ({
  useSendAnalyticsEvent: () => ({
    sendEvent: sendEventMock,
  }),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: vi.fn(() => ({
    userSession: mockSession,
    updateSession: mockUpdateSession,
  })),
}));

vi.mock('@global-torque/ui-kit/form-validation', () => ({
  useFormValidation: vi.fn(() => {
    const model = reactive({ password: '' });
    const isValid = ref(true);

    const onValidate = vi.fn().mockImplementation(() => {
      isValid.value = model.password.length >= 8;
    });

    return {
      model,
      isValid,
      onValidate,
      scrollToError: vi.fn(),
      isFieldRequired: vi.fn(),
      getErrorText: vi.fn(() => []),
      resetValidation: vi.fn(),
    } as any;
  }),
}));

vi.mock('@global-torque/invest-runtime/dialogs', () => ({
  useDialogs: vi.fn(() => ({
    isDialogRefreshSessionOpen: ref(false),
    completeSessionRefresh: mockCompleteSessionRefresh,
  })),
}));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

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
    mockOryErrorHandling.mockReset().mockResolvedValue(undefined);
    mockCompleteSessionRefresh.mockReset();
    mockSession.value = {
      active: true,
      identity: {
        id: 'identity-123',
        traits: { email: 'session@example.com' },
      },
    };

    store = useLoginRefreshStore();
    mockAuthRepository = useRepositoryAuth();
  });

  describe('Password Login', () => {
    it('should handle successful password login', async () => {
      const store = useLoginRefreshStore();
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
          identifier: 'session@example.com',
          password: 'validPassword123!',
        }),
      );
      expect(mockUpdateSession).toHaveBeenCalledWith(mockSession);
      expect(sendEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 200,
        }),
      );
      expect(mockUpdateSession.mock.invocationCallOrder[0]).toBeLessThan(sendEventMock.mock.invocationCallOrder[0]);
      expect(mockCompleteSessionRefresh).toHaveBeenCalledOnce();
      expect(mockCompleteSessionRefresh).toHaveBeenCalledWith(true);
      expect(store.model.password).toBe('');
    });

    it('does not submit when the session email is missing', async () => {
      mockSession.value = {
        active: true,
        identity: {
          id: 'identity-123',
          traits: { email: '   ' },
        },
      };
      const store = useLoginRefreshStore();
      store.model.password = 'validPassword123!';

      await store.loginPasswordHandler();
      expect(store.isLoading).toBe(false);
      expect(mockGetAuthFlow).not.toHaveBeenCalled();
      expect(mockSetLogin).not.toHaveBeenCalled();
      expect(mockCompleteSessionRefresh).not.toHaveBeenCalled();
    });

    it('prevents duplicate submissions while the shared request is pending', async () => {
      const pending = deferred<void>();
      mockSetLogin.mockReturnValueOnce(pending.promise);
      mockSetLoginState.value = { error: null, data: null };
      const store = useLoginRefreshStore();
      store.model.password = 'validPassword123!';

      const first = store.loginPasswordHandler();
      await Promise.resolve();
      const second = store.loginPasswordHandler();
      await Promise.resolve();

      expect(mockGetAuthFlow).toHaveBeenCalledOnce();
      expect(mockSetLogin).toHaveBeenCalledOnce();

      pending.resolve();
      await Promise.all([first, second]);
      expect(store.isLoading).toBe(false);
    });

    it('keeps the dialog available for a wrong password retry', async () => {
      const error = new Error('wrong password');
      mockSetLogin.mockRejectedValueOnce(error);
      mockOryErrorHandling.mockImplementationOnce(async (_error, _flow, resetFlow) => {
        resetFlow();
      });
      const store = useLoginRefreshStore();
      store.model.password = 'validPassword123!';

      await store.loginPasswordHandler();

      expect(store.isLoading).toBe(false);
      expect(mockGetAuthFlow).toHaveBeenCalledOnce();
      expect(mockCompleteSessionRefresh).not.toHaveBeenCalled();
      expect(store.loginErrorText).toEqual(['Unable to confirm your password. Please try again.']);

      mockSetLoginState.value = {
        error: null,
        data: {
          session: {
            id: 'new-session',
            identity: {
              id: 'identity-123',
              traits: { email: 'session@example.com' },
            },
          },
        },
      };
      await store.loginPasswordHandler();

      expect(mockSetLogin).toHaveBeenCalledTimes(2);
      expect(mockCompleteSessionRefresh).toHaveBeenCalledWith(true);
    });

    it('resolves success before delayed telemetry and ignores a later close', async () => {
      const telemetry = deferred<void>();
      sendEventMock.mockReturnValueOnce(telemetry.promise);
      mockSetLoginState.value = {
        error: null,
        data: {
          session: {
            id: 'new-session',
            identity: {
              id: 'identity-123',
              traits: { email: 'session@example.com' },
            },
          },
        },
      };
      const store = useLoginRefreshStore();
      store.beginRefreshSessionDialog();
      store.model.password = 'validPassword123!';

      await store.loginPasswordHandler();

      expect(mockCompleteSessionRefresh).toHaveBeenCalledOnce();
      expect(mockCompleteSessionRefresh).toHaveBeenCalledWith(true);
      expect(store.dismissRefreshSessionDialog()).toBe(false);
      expect(mockCompleteSessionRefresh).toHaveBeenCalledOnce();

      telemetry.resolve();
      await Promise.resolve();
    });

    it('keeps backend errors scoped to the current dialog generation', async () => {
      const backendError = {
        data: {
          responseJson: {
            ui: {
              messages: [{ type: 'error', text: 'Invalid password' }],
            },
          },
        },
      };
      mockSetLoginState.value = { data: null, error: backendError };
      const store = useLoginRefreshStore();
      store.model.password = 'validPassword123!';

      await store.loginPasswordHandler();

      expect(store.loginError).toEqual(backendError);
      expect(mockCompleteSessionRefresh).not.toHaveBeenCalled();
      expect(sendEventMock).toHaveBeenCalledWith(expect.objectContaining({ status_code: 400 }));
    });

    it('ignores a delayed result after dismiss and reopen', async () => {
      const pending = deferred<void>();
      mockSetLogin.mockReturnValueOnce(pending.promise);
      mockSetLoginState.value = {
        error: null,
        data: {
          session: {
            id: 'stale-session',
            identity: {
              id: 'identity-123',
              traits: { email: 'session@example.com' },
            },
          },
        },
      };
      const store = useLoginRefreshStore();
      store.model.password = 'validPassword123!';

      const first = store.loginPasswordHandler();
      await Promise.resolve();
      store.dismissRefreshSessionDialog();
      expect(store.model.password).toBe('');
      store.beginRefreshSessionDialog();
      store.model.password = 'new-dialog-password';
      await store.loginPasswordHandler();
      expect(mockSetLogin).toHaveBeenCalledOnce();
      pending.resolve();
      await first;

      expect(mockUpdateSession).not.toHaveBeenCalled();
      expect(mockCompleteSessionRefresh).not.toHaveBeenCalled();
      expect(store.loginError).toBeNull();
      expect(store.model.password).toBe('new-dialog-password');
    });

    it('ignores a delayed result after the session identity changes', async () => {
      const pending = deferred<void>();
      mockSetLogin.mockReturnValueOnce(pending.promise);
      mockSetLoginState.value = {
        error: null,
        data: {
          session: {
            id: 'stale-session',
            identity: {
              id: 'identity-123',
              traits: { email: 'session@example.com' },
            },
          },
        },
      };
      const store = useLoginRefreshStore();
      store.model.password = 'validPassword123!';

      const attempt = store.loginPasswordHandler();
      await Promise.resolve();
      mockSession.value = {
        active: true,
        identity: {
          id: 'identity-456',
          traits: { email: 'new@example.com' },
        },
      };
      pending.resolve();
      await attempt;

      expect(mockUpdateSession).not.toHaveBeenCalled();
      expect(mockCompleteSessionRefresh).not.toHaveBeenCalled();
      expect(store.loginError).toBeNull();
    });
  });

});
