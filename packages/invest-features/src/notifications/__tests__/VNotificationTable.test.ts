import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../useNotifications.ts', () => ({
  useNotifications: defineStore('notification-table-test', {
    state: () => ({
      filterSettings: [{ value: 'status', title: 'Status', options: ['Read', 'Unread'], model: [] as string[] }],
      tabsSettings: [{ value: 'all', label: 'All' }],
      currentTab: 'all',
      search: '',
      showSearch: true,
      showFilter: true,
      filterResults: 0,
      notificationUserLength: 0,
      showMarkAll: true,
      showFilterPagination: false,
      isLoading: false,
      tableData: [],
    }),
    actions: { markAllAsRead: vi.fn(), onApplyFilter: vi.fn() },
  }),
}));

import VNotificationTable from '../components/VNotificationTable.vue';
import { useNotifications } from '../useNotifications.ts';

describe('Notifications filter artwork', () => {
  it('keeps the store commands and disabled state with owned decorative artwork', async () => {
    setActivePinia(createPinia());
    const wrapper = mount(VNotificationTable, {
      props: { small: true },
      global: { stubs: { VUrlSyncedTabs: true } },
    });
    await flushPromises();
    const filter = wrapper.getComponent({ name: 'VFilter' });
    expect(filter.get('.wd-notification-table__filter-icon--default').attributes('viewBox')).toBe('0 0 16 16');
    expect(filter.get('.wd-notification-table__filter-icon--approved').attributes('aria-hidden')).toBe('true');
    const store = useNotifications();
    vi.spyOn(store, 'onApplyFilter');
    vi.spyOn(store, 'markAllAsRead');
    filter.vm.$emit('apply', [{ value: 'status', title: 'Status', options: ['Read', 'Unread'], model: ['Unread'] }]);
    expect(store.onApplyFilter).toHaveBeenCalledWith([
      { value: 'status', title: 'Status', options: ['Read', 'Unread'], model: ['Unread'] },
    ]);
    await wrapper.get('.wd-notification-table__mark-all').trigger('click');
    expect(store.markAllAsRead).toHaveBeenCalledOnce();
    store.showFilter = false;
    await flushPromises();
    expect(filter.get('button').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});
