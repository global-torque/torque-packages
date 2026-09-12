/**
 * Headless notifications model barrel: the shared SDK-backed notification
 * store, badge composable, and formatter without any Vue component, widget,
 * or stylesheet import. Apps that must not pull invest component CSS into
 * their bundle (Tahoe) consume this subpath; Dashboard/Invest component
 * consumers keep using `./notifications`.
 */
export { useNotifications, type NotificationFilter } from './useNotifications.ts';
export {
  useNotificationBadge,
  type NotificationBadgeOptions,
  type NotificationBadgePosition,
} from './useNotificationBadge.ts';
export { NotificationFormatter } from './notificationFormatter.ts';
