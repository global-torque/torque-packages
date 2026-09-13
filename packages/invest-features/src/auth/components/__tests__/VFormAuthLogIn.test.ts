import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive, toRefs } from 'vue';
import VFormAuthLogIn from '../VFormAuthLogIn.vue';

const loginStore = reactive({
  demoAccountHandler: vi.fn(),
  getErrorText: vi.fn(() => ''),
  isDemoAccountAvailable: true,
  isDemoAccountLoading: false,
  isDisabledButton: false,
  isFieldRequired: vi.fn(() => false),
  isLoading: false,
  loginPasswordHandler: vi.fn(),
  model: reactive({
    email: '',
    password: '',
  }),
  onSignup: vi.fn(),
  setLoginState: {
    error: null,
  },
});

const globalLoaderStore = reactive({
  isLoading: false,
});

vi.mock('../../store/useLogin.ts', () => ({
  useLoginStore: () => loginStore,
}));

vi.mock('@global-torque/invest-runtime/loader', () => ({
  useGlobalLoader: () => globalLoaderStore,
}));

vi.mock('../../links.ts', () => ({
  getAuthLinks: () => ({ forgot: '/forgot', signup: '/signup' }),
}));

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');

  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => toRefs(store),
  };
});

const mountComponent = () => mount(VFormAuthLogIn, {
  global: {
    stubs: {
      Button: {
        props: ['disabled', 'loading'],
        template: `
          <button
            v-bind="$attrs"
            :data-loading="String(loading)"
            :disabled="disabled || loading"
            @click="$emit('click', $event)"
          >
            <slot />
          </button>
        `,
      },
      VFormGroup: {
        template: '<div><slot :is-field-error="false" /></div>',
      },
      VFormInput: {
        props: ['disabled', 'isError', 'modelValue', 'name', 'placeholder', 'size', 'type'],
        template: '<input :type="type || \'text\'" />',
      },
      VFormInputPassword: {
        props: ['disabled', 'isError', 'modelValue', 'name', 'placeholder', 'size', 'revealTabbable'],
        template: '<input type="password" :data-reveal-tabbable="String(revealTabbable)" />',
      },
    },
  },
});

describe('VFormAuthLogIn', () => {
  beforeEach(() => {
    loginStore.demoAccountHandler.mockReset();
    loginStore.getErrorText.mockClear();
    loginStore.isDemoAccountAvailable = true;
    loginStore.isDemoAccountLoading = false;
    loginStore.isDisabledButton = false;
    loginStore.isFieldRequired.mockClear();
    loginStore.isLoading = false;
    loginStore.loginPasswordHandler.mockReset();
    loginStore.onSignup.mockReset();
    globalLoaderStore.isLoading = false;
  });

  it('renders the demo CTA and delegates clicks to the login store', async () => {
    const wrapper = mountComponent();
    const demoButton = wrapper.get('[data-testid="demo-account-button"]');

    expect(demoButton.text()).toContain('Try Demo Account');

    await demoButton.trigger('click');

    expect(loginStore.demoAccountHandler).toHaveBeenCalled();
  });

  it('hides the demo CTA when the snapshot is unavailable', () => {
    loginStore.isDemoAccountAvailable = false;

    const wrapper = mountComponent();

    expect(wrapper.find('[data-testid="demo-account-button"]').exists()).toBe(false);
  });

  it('passes the demo loading state through to the CTA button', () => {
    loginStore.isDemoAccountLoading = true;

    const wrapper = mountComponent();

    expect(wrapper.get('[data-testid="demo-account-button"]').attributes('disabled')).toBeDefined();
  });

  it('submits through the native form submit event', async () => {
    const wrapper = mountComponent();

    await wrapper.get('form').trigger('submit');

    expect(loginStore.loginPasswordHandler).toHaveBeenCalledOnce();
    expect(wrapper.get('[data-testid="signup"]').attributes('type')).toBe('submit');
  });

  it('removes auth password reveal controls from Tab order and gives signup a href', () => {
    const wrapper = mountComponent();

    expect(wrapper.get('input[type="password"]').attributes('data-reveal-tabbable')).toBe('false');
    expect(wrapper.get('.login-form__signup-btn').attributes('href')).toBeDefined();
  });
});
