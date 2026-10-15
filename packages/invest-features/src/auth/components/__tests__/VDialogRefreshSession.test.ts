/* @vitest-environment jsdom */

import { mount } from '@vue/test-utils';
import { reactive, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VDialogRefreshSession from '../VDialogRefreshSession.vue';

const completeSessionRefresh = vi.fn();
const beginRefreshSessionDialog = vi.fn();
const dismissRefreshSessionDialog = vi.fn(() => true);
const loginStore = reactive({
  beginRefreshSessionDialog,
  dismissRefreshSessionDialog,
  getErrorText: vi.fn(() => []),
  getOptions: vi.fn(() => []),
  isDisabledButton: false,
  isFieldRequired: vi.fn(() => false),
  isLoading: false,
  loginErrorText: [],
  loginPasswordHandler: vi.fn(),
  model: reactive({ password: '' }),
  sessionEmail: 'session@example.com',
  setLoginState: { error: null },
});

vi.mock('../..//store/useLoginRefresh.ts', () => ({
  useLoginRefreshStore: () => loginStore,
}));

vi.mock('@global-torque/invest-runtime/dialogs', () => ({
  useDialogs: () => ({ completeSessionRefresh }),
}));

const mountComponent = () =>
  mount(VDialogRefreshSession, {
    props: {
      modelValue: true,
      socialIcons: {} as never,
    },
    attachTo: document.body,
    global: {
      stubs: {
        VQueryDialog: {
          props: ['open', 'queryKey', 'queryValue'],
          emits: ['update:open'],
          template: '<div data-testid="query-dialog"><slot /></div>',
        },
        DialogContent: {
          template: '<section v-bind="$attrs" data-testid="dialog-content"><slot /></section>',
        },
        Separator: {
          template: '<span data-testid="separator" />',
        },
        VFormGroup: {
          template: '<div><slot :is-field-error="false" /></div>',
        },
        VFormInputPassword: {
          props: ['modelValue', 'isError', 'name', 'placeholder', 'size', 'revealTabbable', 'autocomplete'],
          template: '<input type="password" :name="name" :value="modelValue" :autocomplete="autocomplete" data-testid="password" />',
        },
        Button: {
          props: ['disabled'],
          template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
        },
        Spinner: true,
      },
    },
  });

describe('VDialogRefreshSession', () => {
  afterEach(() => {
    completeSessionRefresh.mockReset();
    beginRefreshSessionDialog.mockReset();
    dismissRefreshSessionDialog.mockReset();
    dismissRefreshSessionDialog.mockReturnValue(true);
    loginStore.getErrorText.mockClear();
    loginStore.isDisabledButton = false;
    loginStore.isLoading = false;
    loginStore.loginPasswordHandler.mockReset();
    loginStore.model.password = '';
    loginStore.sessionEmail = 'session@example.com';
  });

  it('renders the current session email, password-only form, and focuses password', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.get('[data-testid="session-email"]').text()).toBe('session@example.com');
    expect(wrapper.find('input[type="email"]').exists()).toBe(false);
    expect(wrapper.findAll('button')).toHaveLength(1);
    expect(wrapper.get('button[type="submit"]').text()).toContain('Confirm');
    expect(wrapper.get('input[type="password"]').attributes('autocomplete')).toBe('current-password');
    await wrapper.get('form').trigger('submit');
    expect(loginStore.loginPasswordHandler).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(wrapper.get('input[type="password"]').element);
    expect(beginRefreshSessionDialog).toHaveBeenCalledOnce();
  });

  it('dismisses through one false completion path', async () => {
    const wrapper = mountComponent();

    await wrapper.setProps({ modelValue: false });

    expect(dismissRefreshSessionDialog).toHaveBeenCalledOnce();
    expect(completeSessionRefresh).toHaveBeenCalledOnce();
    expect(completeSessionRefresh).toHaveBeenCalledWith(false);
  });

  it('invalidates the refresh generation when unmounted', () => {
    const wrapper = mountComponent();

    wrapper.unmount();

    expect(dismissRefreshSessionDialog).toHaveBeenCalledOnce();
    expect(completeSessionRefresh).toHaveBeenCalledOnce();
    expect(completeSessionRefresh).toHaveBeenCalledWith(false);
  });

  it('does not complete false again when a successful generation closes and unmounts', async () => {
    const wrapper = mountComponent();
    dismissRefreshSessionDialog.mockReturnValue(false);

    await wrapper.setProps({ modelValue: false });
    wrapper.unmount();

    expect(dismissRefreshSessionDialog).toHaveBeenCalledTimes(2);
    expect(completeSessionRefresh).not.toHaveBeenCalled();
  });
});
