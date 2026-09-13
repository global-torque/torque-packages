import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import {
  urlEarnOverview,
  urlProfileAccount,
  urlProfileEarn,
  urlProfilePortfolio,
  urlProfileSummary,
} from '../../navigation/links.ts';
import VHeaderPWA from '../VHeaderPWA.vue';

const userLoggedIn = ref(false);
const selectedUserProfileId = ref(0);
const userState = ref({ loading: false });

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({ userLoggedIn }),
}));
vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: {
      isStaticSite: false,
      brand: { title: 'Global Torque' },
    },
  }),
}));
vi.mock('@global-torque/invest-runtime/adapters', () => ({
  getRequiredInvestRuntimeAdapter: () => ({
    getStore: () => ({ getUserState: userState.value }),
  }),
}));
vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia');
  return {
    ...actual,
    storeToRefs: (store: Record<string, unknown>) => {
      if ('getUserState' in store) {
        return { getUserState: userState };
      }
      if ('isDialogLogoutOpen' in store) {
        return { isDialogLogoutOpen: (store as { isDialogLogoutOpen: typeof userLoggedIn }).isDialogLogoutOpen };
      }
      if ('selectedUserProfileId' in store) {
        return { selectedUserProfileId };
      }
      return { userLoggedIn };
    },
  };
});
vi.mock('@global-torque/invest-runtime/profiles', () => ({
  useProfilesStore: () => ({
    selectedUserProfileId,
  }),
}));
vi.mock('@global-torque/ui-kit/breakpoints', () => ({
  useBreakpoints: () => ({
    isDesktopMD: ref(true),
  }),
}));
vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({}),
}));
vi.mock('../../components/VHeaderBar/VHeaderGuest.vue', () => ({
  default: {
    template: '<div data-testid="guest-header"><slot name="leading" /><slot name="logo" /><slot /><slot name="pwa" /><slot name="mobile" /></div>',
  },
}));
vi.mock('../../components/VHeaderBar/VHeaderAuthorized.vue', () => ({
  default: {
    template: '<div data-testid="authorized-header"><slot name="leading" /><slot name="logo" /><slot /><slot name="pwa" /><slot name="mobile" /></div>',
  },
}));

const mountHeader = (
  layout = '',
  path = '/some',
  showProfileLink = false,
  extraProps: Record<string, unknown> = {},
) => mount(VHeaderPWA, {
  props: {
    layout,
    path,
    showProfileLink,
    ...extraProps,
  },
  global: {
    stubs: {
      VSkeleton: true,
      VButton: {
        template: '<button><slot /></button>',
      },
      VLogo: true,
      VHeaderProfilePWA: {
        template: '<div data-testid="profile-menu" />',
      },
      VHeaderProfileMobile: {
        template: '<div data-testid="profile-menu-mobile" />',
      },
      NotificationsSidebarButton: {
        template: '<div class="notifications-sidebar-button" />',
      },
    },
  },
});

describe('VHeaderPWA', () => {
  beforeEach(() => {
    userLoggedIn.value = false;
    selectedUserProfileId.value = 0;
    userState.value = { loading: false };
    window.history.pushState({}, '', '/');
  });

  it('hides back button on root path', () => {
    const wrapper = mountHeader('', '/');
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(false);
  });

  it('shows back button on non-root path', () => {
    const wrapper = mountHeader('', '/some/other');
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(true);
  });

  it('hides logo and profile block when back button is visible', () => {
    userLoggedIn.value = true;
    const wrapper = mountHeader('', '/some/other');
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(true);
    expect(wrapper.find('.v-header__logo').exists()).toBe(false);
    expect(wrapper.find('[data-testid="profile-menu"]').exists()).toBe(false);
  });

  it('hides back button on home layout when user is logged in', () => {
    userLoggedIn.value = true;
    const wrapper = mountHeader('home', '/home');
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(false);
  });

  it('shows login link when logged out on non-auth page', () => {
    const wrapper = mountHeader('', '/offers');
    expect(wrapper.find('[data-testid="guest-header"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Log in');
  });

  it('shows notifications icon when logged in', () => {
    userLoggedIn.value = true;
    const wrapper = mountHeader('', '/offers');
    expect(wrapper.find('[data-testid="authorized-header"]').exists()).toBe(true);
    expect(wrapper.find('.v-header-invest__pwa-notifications').exists()).toBe(true);
  });

  it('shows notifications icon on auth pages for logged in users', () => {
    userLoggedIn.value = true;
    const wrapper = mountHeader('auth-login', '/signin');
    expect(wrapper.find('.v-header-invest__pwa-notifications').exists()).toBe(true);
  });

  it('hides notifications icon on kyc-bo pages', () => {
    userLoggedIn.value = true;
    const wrapper = mountHeader('kyc-bo', '/kyc-bo');
    expect(wrapper.find('.v-header-invest__pwa-notifications').exists()).toBe(false);
  });

  it('shows Sign Up CTA on sign-in page', () => {
    const wrapper = mountHeader('auth-login', '/signin');
    expect(wrapper.text()).toContain('Sign Up');
  });

  it('shows Log In CTA on sign-up page', () => {
    const wrapper = mountHeader('auth-signup', '/signup');
    expect(wrapper.text()).toContain('Log In');
  });

  it('shows profile menu when logged in', () => {
    userLoggedIn.value = true;
    selectedUserProfileId.value = 10;
    const wrapper = mountHeader('', urlProfilePortfolio(10));
    expect(wrapper.find('[data-testid="profile-menu"]').exists()).toBe(true);
  });

  it('suppresses profile, notifications, sidebar, and auth CTAs for an invitation mismatch', () => {
    userLoggedIn.value = true;
    selectedUserProfileId.value = 10;
    const wrapper = mountHeader('auth-signup', '/signup', false, {
      suppressAuthenticatedAccountControls: true,
      showSidebarTrigger: true,
    });

    expect(wrapper.find('[data-testid="profile-menu"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="profile-menu-mobile"]').exists()).toBe(false);
    expect(wrapper.find('.notifications-sidebar-button').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-sidebar-trigger').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Log In');
    expect(wrapper.text()).not.toContain('Sign Up');
  });

  it('hides back button on logged-in account root path', () => {
    userLoggedIn.value = true;
    selectedUserProfileId.value = 10;
    const wrapper = mountHeader('', urlProfileAccount(10));
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(false);
  });

  it('hides back button on logged-in summary root path', () => {
    userLoggedIn.value = true;
    selectedUserProfileId.value = 10;
    const wrapper = mountHeader('', urlProfileSummary(10));
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(false);
  });

  it('hides back button on logged-in earn root path', () => {
    userLoggedIn.value = true;
    selectedUserProfileId.value = 10;
    const wrapper = mountHeader('', urlProfileEarn(10));
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(false);
  });

  it('shows back button on logged-in earn details path', () => {
    userLoggedIn.value = true;
    selectedUserProfileId.value = 10;
    const wrapper = mountHeader('', urlEarnOverview(10, 'pool-1'));
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(true);
  });

  it('keeps nested logged-in account section pages without back button', () => {
    userLoggedIn.value = true;
    selectedUserProfileId.value = 10;
    const wrapper = mountHeader('', '/profile/10/account/history');
    expect(wrapper.find('.v-header-invest__pwa-back').exists()).toBe(false);
  });

  it('shows only back button on offer details page', () => {
    userLoggedIn.value = true;
    const wrapper = mountHeader('offer-single', '/offers/some-offer');
    expect(wrapper.find('[data-testid="profile-menu"]').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-notifications').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-logo').exists()).toBe(false);
    expect(wrapper.find('.v-header__logo').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-login').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-auth').exists()).toBe(false);
    expect(wrapper.find('.v-header-invest__pwa-logout').exists()).toBe(false);
  });

  it('opens profile overlay event instead of browser back for pages opened from user menu', async () => {
    userLoggedIn.value = true;
    window.history.pushState({}, '', '/settings/10/mfa?fromUserMenu=1');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const backSpy = vi.spyOn(window.history, 'back');
    const wrapper = mountHeader('', '/settings/10/mfa');

    await wrapper.find('.v-header-invest__pwa-back').trigger('click');

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(backSpy).not.toHaveBeenCalled();
    dispatchSpy.mockRestore();
    backSpy.mockRestore();
  });
});
