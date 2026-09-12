import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../useNotifications.ts', () => ({
  useNotifications: defineStore('notification-sidebar-test', {
    state: () => ({
      isSidebarOpen: true,
      notificationUnreadLength: 2,
      notificationsHref: '/notifications',
    }),
    actions: { onSidebarToggle(open: boolean) { this.isSidebarOpen = open; } },
  }),
}));
vi.mock('../components/VNotificationTable.vue', () => ({ default: { template: '<div>Updates</div>' } }));

import VNotificationSidebar from '../components/VNotificationSidebar.vue';
import { useNotifications } from '../useNotifications.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Notifications sheet', () => {
  it.each(['click', 'Escape'])('keeps an accessible owned close and %s dismissal', async (action) => {
    setActivePinia(createPinia());
    const wrapper = mount(VNotificationSidebar, { attachTo: document.body });
    await flushPromises();
    const content = document.querySelector('[role="dialog"]')!;
    const controls = content.querySelectorAll('[aria-label="Close"]');
    expect(controls).toHaveLength(1);
    expect(content.textContent).not.toContain('Close');
    expect(content.textContent).toContain('Notifications');
    expect(content.contains(document.activeElement)).toBe(true);
    expect(content.querySelector('a')?.getAttribute('href')).toBe('/notifications');
    expect(content.querySelector('.v-notification-sidebar__close-approved')).not.toBeNull();
    if (action === 'click') (controls[0] as HTMLButtonElement).click();
    else document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(useNotifications().isSidebarOpen).toBe(false);
    wrapper.unmount();
  });
});
