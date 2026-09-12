/* @vitest-environment jsdom */
/* eslint-disable vue/one-component-per-file */

import { mount } from '@vue/test-utils';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const state = vi.hoisted(() => ({
  isStaticSite: undefined as boolean | undefined,
}));

vi.mock('@webdevelop-pro/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    appConfig: {
      isStaticSite: state.isStaticSite,
    },
  }),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('@webdevelop-pro/invest-runtime/dialogs', () => ({
  useDialogs: () => ({
    isDialogLogoutOpen: { value: false },
  }),
}));

vi.mock('../useHeaderUser.ts', () => ({
  useHeaderUser: () => ({
    userEmail: { value: 'investor@example.test' },
    userDisplayName: { value: 'Ada Investor' },
    avatarSrc: { value: 'https://files.example.test/avatar.jpg' },
  }),
}));

vi.mock('@webdevelop-pro/invest-widgets/profiles', () => ({
  useProfileSwitchMenu: () => ({
    selectedProfileLabel: { value: 'Growth SPV' },
    profileItems: { value: [] },
    onSelectProfile: vi.fn(),
  }),
}));

vi.mock('@webdevelop-pro/invest-widgets/notifications/VNotificationsSidebarButton.vue', () => ({
  default: {
    name: 'NotificationsSidebarButton',
    props: {
      isStaticSite: {
        type: String,
        default: '',
      },
      showIcon: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['click'],
    template: `
      <button
        data-testid="notifications-button"
        :data-is-static-site="isStaticSite"
        :data-show-icon="showIcon ? 'true' : 'false'"
        type="button"
        @click="$emit('click')"
      />
    `,
  },
}));

vi.mock('@global-torque/ui-primitives/dropdown-menu', () => ({
  DropdownMenu: { name: 'DropdownMenu', template: '<div><slot /></div>' },
  DropdownMenuTrigger: { name: 'DropdownMenuTrigger', template: '<div><slot /></div>' },
  DropdownMenuContent: { name: 'DropdownMenuContent', template: '<div><slot /></div>' },
  DropdownMenuPortal: {
    name: 'DropdownMenuPortal',
    template: '<div><slot /></div>',
  },
  DropdownMenuItem: {
    name: 'DropdownMenuItem',
    emits: ['click'],
    template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
  },
  DropdownMenuSub: {
    name: 'DropdownMenuSub',
    template: '<div><slot /></div>',
  },
  DropdownMenuSubContent: {
    name: 'DropdownMenuSubContent',
    template: '<div><slot /></div>',
  },
  DropdownMenuSubTrigger: {
    name: 'DropdownMenuSubTrigger',
    template: '<button type="button"><slot /></button>',
  },
}));

vi.mock('../../VAvatarIdentity.vue', () => ({
  default: {
    name: 'VAvatarIdentity',
    props: {
      label: {
        type: String,
        default: '',
      },
      avatarText: {
        type: String,
        default: '',
      },
    },
    template: '<div data-testid="avatar-identity">{{ label }}{{ avatarText }}</div>',
  },
}));

vi.mock('@webdevelop-pro/invest-widgets/profiles/ProfileSwitchMenuList.vue', () => ({
  default: {
    name: 'ProfileSwitchMenuList',
    props: {
      items: {
        type: Array,
        default: () => [],
      },
    },
    emits: ['select'],
    template: '<div data-testid="profile-switch-menu" />',
  },
}));

vi.mock('@webdevelop-pro/invest-widgets/icons/navigation', () => ({
  LogoutMenuIcon: {
    name: 'LogOutIcon',
    template: '<svg data-testid="logout-icon" />',
  },
}));

import VHeaderProfile from '../VHeaderProfile.vue';
import VHeaderProfileMobile from '../VHeaderProfileMobile.vue';

const notificationStaticSiteValue = (wrapper: ReturnType<typeof mount>) => (
  wrapper.find('[data-testid="notifications-button"]').attributes('data-is-static-site')
);

describe('VHeaderProfile static-site config', () => {
  it('passes configured IS_STATIC_SITE to the desktop notifications button', () => {
    state.isStaticSite = true;

    const wrapper = mount(VHeaderProfile, {
      props: {
        menu: [],
        isDesktop: true,
      },
    });

    expect(notificationStaticSiteValue(wrapper)).toBe('true');
  });

  it('passes configured IS_STATIC_SITE to the mobile notifications button', () => {
    state.isStaticSite = true;

    const wrapper = mount(VHeaderProfileMobile, {
      props: {
        menu: [],
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });

    expect(notificationStaticSiteValue(wrapper)).toBe('true');
  });

  it('falls back to an empty static-site value when config is missing', () => {
    state.isStaticSite = undefined;

    const desktopWrapper = mount(VHeaderProfile, {
      props: {
        menu: [],
      },
    });
    const mobileWrapper = mount(VHeaderProfileMobile, {
      props: {
        menu: [],
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });

    expect(notificationStaticSiteValue(desktopWrapper)).toBe('');
    expect(notificationStaticSiteValue(mobileWrapper)).toBe('');
  });
});
