import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import VOfflineStatusBanner from '../VOfflineStatusBanner.vue';

const mountBanner = (props: Record<string, unknown>) => mount(VOfflineStatusBanner, {
  props: props as never,
  global: {
    stubs: {
      VButton: {
        props: ['size', 'color'],
        template: '<button :data-color="color" :data-size="size"><slot /></button>',
      },
    },
  },
});

describe('VOfflineStatusBanner', () => {
  it('stays hidden when the app is neither offline nor reconnected', () => {
    const wrapper = mountBanner({
      isOffline: false,
      isReconnected: false,
      isShowingCachedContent: false,
      lastSyncedAt: null,
    });

    expect(wrapper.find('[data-testid="offline-status-banner"]').exists()).toBe(false);
  });

  it('shows the cached-content offline message and formatted sync timestamp', () => {
    const localeSpy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('Mar 19, 2026, 5:00 PM');
    const wrapper = mountBanner({
      isOffline: true,
      isReconnected: false,
      isShowingCachedContent: true,
      lastSyncedAt: '2026-03-19T17:00:00.000Z',
    });

    expect(wrapper.text()).toContain('Offline mode');
    expect(wrapper.text()).toContain('read-only mode');
    expect(wrapper.text()).toContain('Last synced: Mar 19, 2026, 5:00 PM.');
    expect(wrapper.find('button').text()).toBe('OK');
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);

    localeSpy.mockRestore();
  });

  it('shows the uncached offline message when cached content is unavailable', () => {
    const wrapper = mountBanner({
      isOffline: true,
      isReconnected: false,
      isShowingCachedContent: false,
      lastSyncedAt: null,
    });

    expect(wrapper.text()).toContain('Sections that were not saved on this device may be unavailable');
  });

  it('shows the reconnect message and ignores invalid sync timestamps', () => {
    const wrapper = mountBanner({
      isOffline: false,
      isReconnected: true,
      isShowingCachedContent: false,
      lastSyncedAt: 'not-a-date',
    });

    expect(wrapper.text()).toContain('Back online');
    expect(wrapper.text()).toContain('Connection restored');
    expect(wrapper.text()).not.toContain('Last synced:');
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });

  it('emits dismiss when the button is clicked', async () => {
    const wrapper = mountBanner({
      isOffline: true,
      isReconnected: false,
      isShowingCachedContent: true,
      lastSyncedAt: null,
    });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});
