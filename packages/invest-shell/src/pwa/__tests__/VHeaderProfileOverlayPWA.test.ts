import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import VHeaderProfileOverlayPWA from '../VHeaderProfileOverlayPWA.vue';

vi.mock('@webdevelop-pro/invest-widgets/icons/images/chevron-right.svg', () => ({
  default: { template: '<i data-testid="chevron" />' },
}));
vi.mock('@webdevelop-pro/invest-widgets/icons/images/menu_common/user.svg', () => ({
  default: { template: '<i data-testid="icon-user" />' },
}));
vi.mock('@webdevelop-pro/invest-widgets/icons/images/menu_common/gear.svg', () => ({
  default: { template: '<i data-testid="icon-gear" />' },
}));
vi.mock('@webdevelop-pro/invest-widgets/icons/images/menu_common/help.svg', () => ({
  default: { template: '<i data-testid="icon-help" />' },
}));
vi.mock('@webdevelop-pro/invest-widgets/icons/images/message.svg', () => ({
  default: { template: '<i data-testid="icon-contact" />' },
}));
vi.mock('@webdevelop-pro/invest-widgets/icons/images/menu_common/logout.svg', () => ({
  default: { template: '<i data-testid="icon-logout" />' },
}));

const mountOverlay = (props: Record<string, unknown> = {}) => mount(VHeaderProfileOverlayPWA, {
  props: {
    email: 'maria@webdevelop.pro',
    avatarSrc: '/avatar.png',
    avatarLoading: false,
    accountDetailsHref: '/settings/1/account-details',
    mfaHref: '/settings/1/mfa',
    securityHref: '/settings/1/security',
    howItWorksHref: '/how-it-works',
    contactHref: '/contact-us',
    ...props,
  },
  global: {
    stubs: {
      Teleport: true,
    },
  },
});

describe('VHeaderProfileOverlayPWA', () => {
  it('renders email and account details link', () => {
    const wrapper = mountOverlay();
    expect(wrapper.find('.v-header-profile-pwa__overlay-email').text()).toBe('maria@webdevelop.pro');
    expect(wrapper.find('.v-header-profile-pwa__overlay-link').text()).toBe('Account Details');
    expect(wrapper.find('[data-slot="avatar"]').exists()).toBe(true);
    expect(wrapper.find('.v-header-profile-pwa__overlay-switch-trigger').text()).toContain('Switch profile');
  });

  it('shows the avatar initial while no image is loaded', async () => {
    const wrapper = mountOverlay({ avatarInitial: 'M' });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-slot="avatar-fallback"]').text()).toBe('M');
  });

  it('renders grouped menu items in the expected order', () => {
    const wrapper = mountOverlay();
    const labels = wrapper.findAll('.v-header-profile-pwa__overlay-item-label').map((item) => item.text());

    expect(labels).toEqual([
      'MFA & Password',
      'Account Security',
      'How It Works',
      'Contact Us',
      'Log Out',
    ]);
    expect(wrapper.findAll('.v-header-profile-pwa__overlay-group')).toHaveLength(3);
  });

  it('emits close on close button click', async () => {
    const wrapper = mountOverlay();
    await wrapper.find('.v-header-profile-pwa__overlay-close').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('emits logout on logout button click', async () => {
    const wrapper = mountOverlay();
    await wrapper.find('.v-header-profile-pwa__overlay-item--logout').trigger('click');
    expect(wrapper.emitted('logout')).toBeTruthy();
  });

  it('links the Change account photo action to Account Details', () => {
    const wrapper = mountOverlay();
    const action = wrapper.find('.v-header-profile-pwa__overlay-avatar-btn');
    expect(action.element.tagName).toBe('A');
    expect(action.attributes('href')).toBe('/settings/1/account-details');
    expect(action.attributes('aria-label')).toBe('Change account photo');
    expect(action.text()).toContain('Change account photo');
  });

  it('emits switch-profile-open on switch trigger click', async () => {
    const wrapper = mountOverlay();
    await wrapper.find('.v-header-profile-pwa__overlay-switch-trigger').trigger('click');
    expect(wrapper.emitted('switch-profile-open')).toBeTruthy();
  });

  it('hides optional links when hrefs are missing', () => {
    const wrapper = mountOverlay({
      accountDetailsHref: '',
      mfaHref: '',
      securityHref: '',
      howItWorksHref: '',
      contactHref: '',
    });
    expect(wrapper.find('.v-header-profile-pwa__overlay-link').exists()).toBe(false);
    const items = wrapper.findAll('.v-header-profile-pwa__overlay-item');
    expect(items).toHaveLength(1);
    expect(items[0]?.text()).toContain('Log Out');
  });
});
