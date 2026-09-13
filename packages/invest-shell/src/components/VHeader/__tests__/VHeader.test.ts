import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import VHeader from '../VHeader.vue';

const userLoggedIn = ref(false);
const userState = ref({ loading: false });

vi.mock('@global-torque/invest-runtime/adapters', () => ({
  getRequiredInvestRuntimeAdapter: () => ({
    getStore: () => ({
      getUserState: userState,
    }),
  }),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({}),
}));
vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => {
      if ('getUserState' in store) {
        return { getUserState: userState };
      }
      return { userLoggedIn };
    },
  };
});
vi.mock('@global-torque/ui-kit/breakpoints', () => ({
  useBreakpoints: () => ({
    isDesktopMD: ref(true),
  }),
}));
vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn(),
}));
vi.mock('../../VHeaderBar/VHeaderGuest.vue', () => ({
  default: {
    template: '<div data-testid="guest-header"><slot /><slot name="mobile" /><slot name="leading" /><slot name="logo" /><slot name="pwa" /></div>',
  },
}));
vi.mock('../../VHeaderBar/VHeaderAuthorized.vue', () => ({
  default: {
    template: '<div data-testid="authorized-header"><slot /><slot name="mobile" /><slot name="leading" /><slot name="logo" /><slot name="pwa" /></div>',
  },
}));
vi.mock('../VHeaderProfileMobile.vue', () => ({
  default: {
    name: 'VHeaderProfileMobile',
    template: '<div data-testid="profile-mobile" />',
  },
}));

const mountHeader = (layout = '', extraProps: Record<string, unknown> = {}) => mount(VHeader, {
  props: {
    layout,
    path: '/any',
    showProfileLink: true,
    ...extraProps,
  },
  global: {
    stubs: {
      VSkeleton: true,
      VButton: {
        template: '<button><slot /></button>',
      },
      VHeaderProfile: {
        template: '<div data-testid="profile-menu" />',
      },
      VHeaderProfileMobile: true,
    },
  },
});

describe('VHeader (web)', () => {
  beforeEach(() => {
    userLoggedIn.value = false;
    userState.value = { loading: false };
  });

  it('shows both auth buttons on a regular page', () => {
    const wrapper = mountHeader('');
    expect(wrapper.find('[data-testid="guest-header"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Log In');
    expect(wrapper.text()).toContain('Sign Up');
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-login').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-logout').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-auth').exists()).toBe(false);
  });

  it('shows only Sign Up on sign-in page', () => {
    const wrapper = mountHeader('auth-login');
    expect(wrapper.text()).not.toContain('Log In');
    expect(wrapper.text()).toContain('Sign Up');
    expect(wrapper.find('.v-header-invest__pwa-auth').exists()).toBe(false);
  });

  it('shows only Log In on sign-up page', () => {
    const wrapper = mountHeader('auth-signup');
    expect(wrapper.text()).toContain('Log In');
    expect(wrapper.text()).not.toContain('Sign Up');
    expect(wrapper.find('.v-header-invest__pwa-auth').exists()).toBe(false);
  });

  it('shows profile menu when logged in', () => {
    userLoggedIn.value = true;
    const wrapper = mountHeader('');
    expect(wrapper.find('[data-testid="authorized-header"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="profile-menu"]').exists()).toBe(true);
    expect(wrapper.find('.v-header-invest__pwa-logout').exists()).toBe(false);
  });

  it('suppresses every authenticated account control for an invitation mismatch', () => {
    userLoggedIn.value = true;
    const wrapper = mountHeader('auth-signup', {
      suppressAuthenticatedAccountControls: true,
    });

    expect(wrapper.find('[data-testid="profile-menu"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="profile-mobile"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Log In');
    expect(wrapper.text()).not.toContain('Sign Up');
  });
});
