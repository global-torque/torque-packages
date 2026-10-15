/* @vitest-environment jsdom */

import { mount } from '@vue/test-utils';
import { reactive, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VDialogRefreshSession from '../VDialogRefreshSession.vue';

const completeSessionRefresh = vi.fn();
const beginRefreshSessionDialog = vi.fn();
const dismissRefreshSessionDialog = vi.fn(() => true);
const mountedWrappers: ReturnType<typeof mount>[] = [];
const loginStore = reactive({
  beginRefreshSessionDialog,
  dismissRefreshSessionDialog,
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

const mountComponent = () => {
  const wrapper = mount(VDialogRefreshSession, {
    props: {
      modelValue: true,
      socialIcons: {} as never,
    },
    attachTo: document.body,
    global: {
      stubs: {
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
  mountedWrappers.push(wrapper);
  return wrapper;
};

const flushDialog = async (wrapper: ReturnType<typeof mountComponent>) => {
  await wrapper.vm.$nextTick();
  await wrapper.vm.$nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
};

describe('VDialogRefreshSession', () => {
  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    completeSessionRefresh.mockReset();
    beginRefreshSessionDialog.mockReset();
    dismissRefreshSessionDialog.mockReset();
    dismissRefreshSessionDialog.mockReturnValue(true);
    loginStore.isDisabledButton = false;
    loginStore.isLoading = false;
    loginStore.loginPasswordHandler.mockReset();
    loginStore.model.password = '';
    loginStore.sessionEmail = 'session@example.com';
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('renders the current session email and focuses password on open and reopen', async () => {
    const wrapper = mountComponent();
    await flushDialog(wrapper);

    const sessionEmail = document.querySelector('[data-testid="session-email"]');
    const password = document.querySelector<HTMLInputElement>('input[type="password"]');
    const form = document.querySelector<HTMLFormElement>('form');
    expect(sessionEmail?.textContent).toBe('session@example.com');
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toContain('Confirm');
    expect(password?.getAttribute('autocomplete')).toBe('current-password');
    expect(document.activeElement).toBe(password);
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(loginStore.loginPasswordHandler).toHaveBeenCalledOnce();
    expect(beginRefreshSessionDialog).toHaveBeenCalledOnce();

    await wrapper.setProps({ modelValue: false });
    await flushDialog(wrapper);
    await wrapper.setProps({ modelValue: true });
    await flushDialog(wrapper);

    expect(document.activeElement).toBe(document.querySelector('input[type="password"]'));
    expect(beginRefreshSessionDialog).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it('dismisses through one false completion path', async () => {
    const wrapper = mountComponent();

    await wrapper.setProps({ modelValue: false });
    await flushDialog(wrapper);

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
