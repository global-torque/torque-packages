import type {
  INotification,
  INotificationDataFields,
} from '@global-torque/domain-types/notificationsTypes';
import { assertCanonicalDecimalString } from '../decimal/canonicalDecimal.ts';

export function assertNotificationShareFields(notification: INotification): void {
  const fields = notification?.data?.fields ?? {} as INotificationDataFields;
  if (fields.confirmed_shares !== undefined) {
    assertCanonicalDecimalString(fields.confirmed_shares, 'confirmed_shares');
  }
  if (fields.subscribed_shares !== undefined) {
    assertCanonicalDecimalString(fields.subscribed_shares, 'subscribed_shares');
  }
}
