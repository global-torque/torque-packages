/* eslint-disable vue/one-component-per-file */

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import VHeader from './VHeaderBar.vue';
import VHeaderAuthorized from './VHeaderAuthorized.vue';
import VHeaderGuest from './VHeaderGuest.vue';

const scrollY = ref(0);
const isDesktopMD = ref(true);

vi.mock('@vueuse/core', async () => ({
  ...await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core'),
  useWindowScroll: () => ({
    y: scrollY,
  }),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('@global-torque/ui-kit/breakpoints', () => ({
  useBreakpoints: () => ({
    isDesktopMD,
  }),
}));

vi.mock('./VHeaderMobile.vue', () => ({
  __esModule: true,
  __isTeleport: false,
  default: defineComponent({
    name: 'VHeaderMobile',
    template: '<div data-testid="mobile-menu"><slot /></div>',
  }),
}));

vi.mock('./VMenuProfileLink.vue', () => ({
  __esModule: true,
  __isTeleport: false,
  default: defineComponent({
    name: 'VMenuProfileLink',
    props: {
      userLoggedIn: Boolean,
      urlProfile: {
        type: [String, Function],
        default: '',
      },
    },
    template: '<div data-testid="profile-link" />',
  }),
}));

const global = {
  stubs: {
    ClientOnly: {
      template: '<div><slot /></div>',
    },
    VLogo: {
      template: '<a data-testid="logo" />',
    },
    VHeaderNavigation: {
      props: ['menu'],
      template: '<nav data-testid="navigation" />',
    },
  },
};

describe('VHeader variants', () => {
  beforeEach(() => {
    scrollY.value = 0;
    isDesktopMD.value = true;
  });

  it('keeps guest as the default variant', () => {
    const wrapper = mount(VHeader, {
      global,
    });

    expect(wrapper.get('header').attributes('data-variant')).toBe('guest');
  });

  it('does not render the profile link for the guest variant', () => {
    const wrapper = mount(VHeaderGuest, {
      props: {
        isMobilePWA: true,
        showProfileLink: true,
        userLoggedIn: true,
        urlProfile: '/profile',
      },
      global,
    });

    expect(wrapper.find('[data-testid="profile-link"]').exists()).toBe(false);
  });

  it('renders the mobile menu trigger for PWA headers on mobile widths', async () => {
    isDesktopMD.value = false;

    const wrapper = mount(VHeader, {
      props: {
        isMobilePWA: true,
        showMobileSidebar: true,
      },
      global,
    });

    await vi.dynamicImportSettled();
    await flushPromises();

    expect(wrapper.find('[data-testid="mobile-menu"]').exists()).toBe(true);
  });

  it('passes the authorized variant through the wrapper', () => {
    const wrapper = mount(VHeaderAuthorized, {
      props: {
        isMobilePWA: true,
        showProfileLink: true,
        userLoggedIn: true,
        urlProfile: '/profile',
      },
      global: {
        stubs: {
          VHeader: {
            props: ['variant', 'showProfileLink'],
            template: '<div data-testid="base-header" :data-variant="variant" :data-show-profile-link="String(showProfileLink)" />',
          },
        },
      },
    });

    expect(wrapper.get('[data-testid="base-header"]').attributes('data-variant')).toBe('authorized');
    expect(wrapper.get('[data-testid="base-header"]').attributes('data-show-profile-link')).toBe('true');
  });
});
