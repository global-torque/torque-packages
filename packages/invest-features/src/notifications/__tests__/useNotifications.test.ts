import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, ref } from 'vue';
import type { INotification } from '@global-torque/domain-types/notificationsTypes';

const sdk = vi.hoisted(() => ({
  list: vi.fn(),
  markAllRead: vi.fn(),
  markRead: vi.fn(),
}));
const reportError = vi.hoisted(() => vi.fn());

vi.mock('@global-torque/invest-runtime/application-context', () => ({
  useInvestApplicationContext: () => ({
    createNotificationsSdkResource: () => sdk,
  }),
}));
vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({ userLoggedIn: ref(true) }),
}));
vi.mock('@global-torque/ui-kit/breakpoints', () => ({
  useBreakpoints: () => ({ isTablet: ref(false) }),
}));
vi.mock('@global-torque/invest-runtime/error/errorReporting', () => ({ reportError }));
vi.mock('../notificationFormatter.ts', () => ({
  NotificationFormatter: class {
    constructor(private readonly notification: INotification) {}
    format() {
      return {
        ...this.notification,
        isUnread: this.notification.status === 'unread',
        buttonHref: '/notifications',
        buttonText: 'View',
        tagText: this.notification.type,
        tagBackground: 'default',
      };
    }
  },
}));

import { useNotifications } from '../useNotifications.ts';

const notification = (id: number, overrides: Partial<INotification> = {}): INotification => ({
  id,
  user_id: 10,
  content: `Notification ${id}`,
  status: 'unread',
  type: 'investment_update',
  data: {
    obj: 'investment',
    object_id: 20,
    fields: { type: 'investment_update', object_id: 20, confirmed_shares: '2' },
  },
  created_at: '2026-08-19T00:00:00Z',
  updated_at: '2026-08-19T00:00:00Z',
  ...overrides,
});

describe('useNotifications', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    sdk.list.mockResolvedValue({ data: [] });
    sdk.markAllRead.mockResolvedValue(undefined);
    sdk.markRead.mockResolvedValue(undefined);
  });

  it('loads, validates, formats, filters, and counts notifications in one model', async () => {
    const invalid = notification(2);
    invalid.data.fields.confirmed_shares = 2 as never;
    sdk.list.mockResolvedValue({
      data: [notification(1), invalid, notification(3, { status: 'read', type: 'profile_update' })],
    });
    const store = useNotifications();

    const loaded = await store.loadAll();
    store.isLoading = false;
    store.currentTab = 'investments';
    await nextTick();

    expect(loaded.map(item => item.id)).toEqual([1, 3]);
    expect(store.unreadNotificationsCount).toBe(1);
    expect(store.tableData.map(item => item.id)).toEqual([1]);
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('marks one or all rows read through the canonical SDK resource', async () => {
    sdk.list.mockResolvedValue({ data: [notification(1), notification(2)] });
    const store = useNotifications();
    await store.loadAll();

    await store.markAsReadById(1);
    expect(sdk.markRead).toHaveBeenCalledWith({ id: 1 });
    expect(store.unreadNotificationsCount).toBe(1);

    await store.markAllAsRead();
    expect(sdk.markAllRead).toHaveBeenCalledOnce();
    expect(store.unreadNotificationsCount).toBe(0);
  });

  it('upserts valid WebSocket rows and ignores invalid payloads', () => {
    const store = useNotifications();
    store.updateNotificationsData(JSON.stringify(notification(5)));
    store.updateNotificationsData('{invalid');

    expect(store.formattedNotifications.map(item => item.id)).toEqual([5]);
    expect(store.unreadNotificationsCount).toBe(1);
  });

  it('resets server state, filters, cache, and sidebar state', async () => {
    sdk.list.mockResolvedValue({ data: [notification(1)] });
    const store = useNotifications();
    await store.loadAll();
    store.onSidebarToggle(true);

    store.resetAll();

    expect(store.formattedNotifications).toEqual([]);
    expect(store.getAllState.data).toBeUndefined();
    expect(store.isSidebarOpen).toBe(false);
  });
});
