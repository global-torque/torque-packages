import {
  computed,
  onMounted,
} from 'vue';
import { storeToRefs } from 'pinia';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import { useNotifications } from './useNotifications.ts';

export type NotificationBadgePosition = 'absolute' | 'inline';

export type NotificationBadgeOptions = {
  count?: number;
  position: NotificationBadgePosition;
  customClass?: string;
};

export function useNotificationBadge(options: NotificationBadgeOptions) {
  const sessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(sessionStore as any) as any;

  const notificationsStore = useNotifications();
  const { unreadNotificationsCount, getAllState } = storeToRefs(notificationsStore as any) as any;

  const hasResolvedNotifications = computed(() => (
    getAllState.value?.data !== undefined || Boolean(getAllState.value?.error)
  ));

  onMounted(() => {
    if (!userLoggedIn.value) {
      return;
    }

    const isLoading = Boolean(getAllState.value?.loading);

    if (!hasResolvedNotifications.value && !isLoading) {
      notificationsStore.loadData();
    }
  });

  const displayCount = computed(() => options.count ?? unreadNotificationsCount.value);
  const shouldShowLoading = computed(() => (
    options.count === undefined
    && userLoggedIn.value
    && !hasResolvedNotifications.value
  ));
  const shouldShow = computed(() => !shouldShowLoading.value && displayCount.value > 0);

  const badgeClasses = computed(() => [
    'notification-number',
    `notification-number--${options.position}`,
    options.customClass,
  ]);

  return {
    displayCount,
    shouldShowLoading,
    shouldShow,
    badgeClasses,
  };
}
