import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useLoginRefreshStore } from '../useLoginRefresh.ts';

const mockUpdateSession = vi.fn();
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

vi.mock('../../data/auth.repository.ts', () => ({
  useRepositoryAuth: vi.fn(() => ({
    flowId: mockFlowId,
    csrfToken: mockCsrfToken,
    getAuthFlow: mockGetAuthFlow,
    setLogin: mockSetLogin,
    getSchemaState: mockGetSchemaState,
    setLoginState: mockSetLoginState,
    getAuthFlowState: mockGetAuthFlowState,
  })),
}));

vi.mock('@global-torque/invest-runtime/error/oryResponseHandling', () => ({
  oryResponseHandling: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/error/oryErrorHandling', () => ({
  oryErrorHandling: mockOryErrorHandling,
}));

vi.mock('@global-torque/invest-runtime/analytics/useSendAnalyticsEvent', () => ({
  useSendAnalyticsEvent: () => ({ sendEvent: sendEventMock }),
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
  useDialogs: vi.fn(() => ({ completeSessionRefresh: mockCompleteSessionRefresh })),
}));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('useLoginRefreshStore', () => {
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
  });

  it('uses the current session email and fresh CSRF token for a successful confirmation', async () => {
    const session = {
      id: 'new-session',
      identity: {
        id: 'identity-123',
        traits: { email: 'session@example.com' },
      },
    };
    mockGetAuthFlow.mockImplementationOnce(async () => {
      mockCsrfToken.value = 'fresh-refresh-csrf-token';
    });
    mockSetLoginState.value = { error: null, data: { session } };
    const store = useLoginRefreshStore();
    store.model.password = 'validPassword123!';

    await store.loginPasswordHandler();

    expect(mockSetLogin).toHaveBeenCalledWith(
      'test-flow-id',
      expect.objectContaining({
        csrf_token: 'fresh-refresh-csrf-token',
        identifier: 'session@example.com',
        password: 'validPassword123!',
      }),
    );
    expect(mockUpdateSession).toHaveBeenCalledWith(session);
    expect(mockCompleteSessionRefresh).toHaveBeenCalledWith(true);
    expect(sendEventMock).toHaveBeenCalledWith(expect.objectContaining({ status_code: 200 }));
    expect(mockUpdateSession.mock.invocationCallOrder[0]).toBeLessThan(sendEventMock.mock.invocationCallOrder[0]);
    expect(store.model.password).toBe('');
    expect(store.isLoading).toBe(false);
  });

  it('keeps the dialog available for a wrong-password retry with a fresh flow', async () => {
    const error = new Error('wrong password');
    mockSetLogin.mockRejectedValueOnce(error);
    const store = useLoginRefreshStore();
    store.model.password = 'validPassword123!';

    await store.loginPasswordHandler();

    expect(mockGetAuthFlow).toHaveBeenCalledOnce();
    expect(mockCompleteSessionRefresh).not.toHaveBeenCalled();
    expect(store.model.password).toBe('validPassword123!');
    expect(store.isLoading).toBe(false);

    mockSetLoginState.value = {
      error: null,
      data: {
        session: {
          id: 'retry-session',
          identity: {
            id: 'identity-123',
            traits: { email: 'session@example.com' },
          },
        },
      },
    };
    await store.loginPasswordHandler();

    expect(mockGetAuthFlow).toHaveBeenCalledTimes(2);
    expect(mockSetLogin).toHaveBeenCalledTimes(2);
    expect(mockCompleteSessionRefresh).toHaveBeenCalledWith(true);
  });

  it('ignores a successful response that completes after the dialog was dismissed', async () => {
    const pending = deferred<void>();
    mockSetLogin.mockReturnValueOnce(pending.promise);
    const store = useLoginRefreshStore();
    store.model.password = 'validPassword123!';

    const attempt = store.loginPasswordHandler();
    await Promise.resolve();
    expect(mockSetLogin).toHaveBeenCalledOnce();

    store.resetForm();
    expect(store.model.password).toBe('');
    expect(store.isLoading).toBe(true);
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
    pending.resolve();
    await attempt;

    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(mockCompleteSessionRefresh).not.toHaveBeenCalled();
    expect(store.isLoading).toBe(false);
  });
});
