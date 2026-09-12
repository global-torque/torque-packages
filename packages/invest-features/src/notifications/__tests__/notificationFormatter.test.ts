import { describe, expect, it } from 'vitest';
import { NotificationFormatter } from '../notificationFormatter.ts';
import type { INotification } from '@webdevelop-pro/domain-types/notificationsTypes';

const createNotification = (
  overrides: Partial<INotification> = {},
): INotification => ({
  id: 1,
  user_id: 10,
  content: 'Wallet updated',
  status: 'unread',
  type: 'wallet_update',
  data: {
    obj: 'notification',
    object_id: 20,
    fields: {
      type: 'wallet_update',
      object_id: 20,
    },
  },
  created_at: '2026-04-08T17:37:45Z',
  updated_at: '2026-04-08T17:38:45Z',
  ...overrides,
});

describe('NotificationFormatter', () => {
  it('capitalizes default notification tag text without changing the rest', () => {
    const formatted = new NotificationFormatter(createNotification()).format();

    expect(formatted.tagText).toBe('Wallet_update');
    expect(formatted.isNotificationWallet).toBe(true);
    expect(formatted.isUnread).toBe(true);
  });

  it('keeps special profile notification tag text unchanged', () => {
    const formatted = new NotificationFormatter(createNotification({
      type: 'profile_update',
    })).format();

    expect(formatted.tagText).toBe('Investment Profile');
  });

  it('rejects numeric aggregate share tokens at the notification boundary', () => {
    const notification = createNotification();
    notification.data.fields.confirmed_shares = 2 as never;
    expect(() => new NotificationFormatter(notification))
      .toThrow('confirmed_shares must be a canonical decimal string');
  });
});
