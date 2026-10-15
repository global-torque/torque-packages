/* @vitest-environment jsdom */

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRepositoryAuth } from '../../data/auth.repository.ts';
import VFormAuthLogInRefresh from '../../components/VFormAuthLogInRefresh.vue';

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
const mockSession = ref({
  active: true,
  identity: {
    id: 'identity-123',
    traits: { email: 'session@example.com' },
  },
});
const mockCompleteSessionRefresh = vi.fn();
const sendEventMock = vi.fn().mockResolvedValue(undefined);

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

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: vi.fn(() => ({
    userSession: mockSession,
    updateSession: mockUpdateSession,
  })),
}));

vi.mock('@global-torque/invest-runtime/dialogs', () => ({
  useDialogs: vi.fn(() => ({
    completeSessionRefresh: mockCompleteSessionRefresh,
  })),
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

// Keep the public UI-kit form-validation implementation in this test.

const mountComponent = () => mount(VFormAuthLogInRefresh, {
  global: {
    stubs: {
      Button: {
        props: ['disabled'],
        template: '<button type="submit" :disabled="disabled"><slot /></button>',
      },
      Spinner: {
        template: '<span data-testid="spinner" />',
      },
    },
  },
});

const flushVueUpdates = async () => {
  await nextTick();
  await nextTick();
};

describe('VFormAuthLogInRefresh with the public form-validation helper', () => {
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
    mockSession.value = {
      active: true,
      identity: {
        id: 'identity-123',
        traits: { email: 'session@example.com' },
      },
    };
  });

  it('shows frontend feedback for a short password, blocks transport, then clears after a valid submit', async () => {
    const wrapper = mountComponent();
    const password = wrapper.get('input[type="password"]');

    await password.setValue('short');
    await wrapper.get('form').trigger('submit');
    await flushVueUpdates();

    expect(wrapper.get('[data-testid="input-error"]').text()).toContain('Should have at least 8 characters');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    expect(mockGetAuthFlow).not.toHaveBeenCalled();
    expect(mockSetLogin).not.toHaveBeenCalled();

    await password.setValue('validPassword123!');
    await wrapper.get('form').trigger('submit');
    await flushVueUpdates();

    expect(wrapper.find('[data-testid="input-error"]').exists()).toBe(false);
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
    expect(mockGetAuthFlow).toHaveBeenCalledOnce();
    expect(mockSetLogin).toHaveBeenCalledOnce();

    wrapper.unmount();
  });
});
