import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { h } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { IFormattedNotification } from '@global-torque/domain-types/notificationsTypes';

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

const notification = {
  id: 42,
  created_at: '2026-11-18T12:00:00Z',
  content: 'A notification',
  tagText: 'Notice',
  tagBackground: 'default',
  buttonText: 'Open',
  buttonHref: '/notifications/42',
  isUnread: false,
} as unknown as IFormattedNotification;

function mountTable(options: Parameters<typeof mount>[1] = {}) {
  setActivePinia(createPinia());
  useNotifications().tableData = [notification];
  return mount(VNotificationTable, {
    ...options,
    global: {
      ...options.global,
      stubs: {
        VUrlSyncedTabs: true,
        VNotificationTableItem: {
          props: ['data'],
          template: '<tr data-slot="table-row"><td>Notice</td><td><slot name="actions" /></td></tr>',
        },
        ...options.global?.stubs,
      },
    },
  });
}

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

  it('forwards typed row slots in row order without adding invalid tbody children', async () => {
    const rowActions = vi.fn(({ item }: { item: IFormattedNotification }) => h(
      'span', { 'data-testid': 'row-actions' }, String(item.id),
    ));
    const afterRow = vi.fn(({ item }: { item: IFormattedNotification }) => h(
      'tr', { 'data-testid': 'after-row' }, [h('td', { colspan: 2 }, `After ${item.id}`)],
    ));
    const wrapper = mountTable({
      slots: {
        'row-actions': rowActions,
        'after-row': afterRow,
      },
    });
    await flushPromises();

    expect(rowActions.mock.calls[0]?.[0]).toEqual({ item: notification });
    expect(afterRow.mock.calls[0]?.[0]).toEqual({ item: notification });
    const rows = Array.from(wrapper.get('tbody').element.children);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.tagName)).toEqual(['TR', 'TR']);
    expect(rows[0]?.getAttribute('data-slot')).toBe('table-row');
    expect(rows[1]?.getAttribute('data-testid')).toBe('after-row');
    expect(rows[1]?.querySelector('td')?.getAttribute('colspan')).toBe('2');
    expect(wrapper.get('[data-testid="row-actions"]').text()).toBe('42');
    wrapper.unmount();
  });

  it('keeps no-slot tables unchanged and does not invoke slots in small tables', async () => {
    const noSlots = mountTable();
    await flushPromises();
    expect(Array.from(noSlots.get('tbody').element.children)).toHaveLength(1);
    noSlots.unmount();

    const rowActions = vi.fn(() => h('span', 'Comments'));
    const afterRow = vi.fn(() => h('tr', [h('td', { colspan: 2 }, 'Comments') ]));
    const small = mountTable({
      props: { small: true },
      slots: {
        'row-actions': rowActions,
        'after-row': afterRow,
      },
    });
    await flushPromises();
    expect(rowActions).not.toHaveBeenCalled();
    expect(afterRow).not.toHaveBeenCalled();
    expect(Array.from(small.get('tbody').element.children)).toHaveLength(1);
    small.unmount();
  });
});
