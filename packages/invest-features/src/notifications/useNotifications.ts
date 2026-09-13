import {
  ref, computed,
  watch,
} from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import type {
  IFormattedNotification,
  INotification,
} from '@global-torque/domain-types/notificationsTypes';
import { useBreakpoints } from '@global-torque/ui-kit/breakpoints';
import { reportError } from '@global-torque/invest-runtime/error/errorReporting';
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import { createFormatterCache } from '@global-torque/invest-core/repository/formatterCache';
import { assertNotificationShareFields } from '@global-torque/invest-core/notifications/shareFields';
import {
  createInitialActionState,
  type ActionState,
} from '@global-torque/invest-data/repository';
import { NotificationFormatter } from './notificationFormatter.ts';
import { getInvestDataAppLinks } from '@global-torque/invest-data/service/dataClientConfig';

export interface NotificationFilter {
  value: string;
  title: string;
  options: string[];
  model: string[];
}

const withActionState = async <T>(
  state: { value: ActionState<T> },
  operation: () => Promise<T>,
): Promise<T> => {
  state.value.loading = true;
  state.value.error = null;
  try {
    const data = await operation();
    state.value.data = data;
    return data;
  } catch (error) {
    state.value.error = error instanceof Error ? error : new Error(String(error));
    throw error;
  } finally {
    state.value.loading = false;
  }
};

export const useNotifications = defineStore('notifications', () => {
  const notificationsResource = useInvestApplicationContext().createNotificationsSdkResource();
  const formattedNotifications = ref<IFormattedNotification[]>([]);
  const getAllState = ref(createInitialActionState<INotification[]>());
  const markAllAsReadState = ref(createInitialActionState<void>());
  const markAsReadByIdState = ref(createInitialActionState<void>());
  const notificationCache = createFormatterCache<INotification, IFormattedNotification>({
    getKey: notification => notification.id,
    getSignature: notification => [
      notification.updated_at,
      notification.status,
      notification.type,
      notification.content,
      JSON.stringify(notification.data?.fields ?? {}),
    ].join('|'),
    format: notification => new NotificationFormatter(notification).format(),
  });
  const notificationsHref = computed(() => getInvestDataAppLinks().notifications);

  const unreadNotificationsCount = computed(() => formattedNotifications.value.reduce(
    (count, item) => count + (item.status === 'unread' && item.type !== 'internal' ? 1 : 0),
    0,
  ));

  const setFormattedNotifications = (items: INotification[]) => {
    const validItems: INotification[] = [];
    const formattedItems: IFormattedNotification[] = [];
    for (const notification of items) {
      try {
        assertNotificationShareFields(notification);
        validItems.push(notification);
        formattedItems.push(notificationCache.format(notification));
      } catch (error) {
        reportError(error, `Ignored notification ${notification.id} because its share fields are invalid`);
      }
    }
    formattedNotifications.value = formattedItems;
    return validItems;
  };

  const loadAll = async () => withActionState(getAllState, async () => {
    const response = await notificationsResource.list();
    return setFormattedNotifications([...response.data] as unknown as INotification[]);
  });

  const markAllAsReadRequest = async () => withActionState(markAllAsReadState, async () => {
    await notificationsResource.markAllRead();
    getAllState.value.data = (getAllState.value.data ?? []).map(item => ({ ...item, status: 'read' }));
    formattedNotifications.value = formattedNotifications.value.map(item => ({
      ...item,
      status: 'read',
      isUnread: false,
    }));
  });

  const markAsReadByIdRequest = async (id: number) => withActionState(markAsReadByIdState, async () => {
    await notificationsResource.markRead({ id });
    getAllState.value.data = (getAllState.value.data ?? []).map(item => (
      item.id === id ? { ...item, status: 'read' } : item
    ));
    formattedNotifications.value = formattedNotifications.value.map(item => (
      item.id === id ? { ...item, status: 'read', isUnread: false } : item
    ));
  });

  const updateNotificationsData = (data: string) => {
    let notification: INotification;
    try {
      notification = JSON.parse(data) as INotification;
      assertNotificationShareFields(notification);
    } catch {
      return;
    }
    const formatted = notificationCache.format(notification);
    const raw = (getAllState.value.data ?? []).filter(item => item.id !== notification.id);
    getAllState.value.data = [notification, ...raw];
    const current = formattedNotifications.value.filter(item => item.id !== formatted.id);
    formattedNotifications.value = [formatted, ...current];
  };

  const resetAll = () => {
    formattedNotifications.value = [];
    notificationCache.clear();
    getAllState.value = createInitialActionState<INotification[]>();
    markAllAsReadState.value = createInitialActionState<void>();
    markAsReadByIdState.value = createInitialActionState<void>();
    isSidebarOpen.value = false;
  };
  const userSessionStore = useSessionStore();
  const { userLoggedIn } = storeToRefs(userSessionStore as any) as any;
  const { isTablet } = useBreakpoints();

  /* * Loading State * */
  const isLoading = ref(true);
  let loadingStateTimeout: ReturnType<typeof setTimeout> | undefined;

  // Watch lightweight state fields only; avoid reacting to full-array identity changes.
  watch(() => ({
    getAllLoading: getAllState.value.loading,
    markAllLoading: markAllAsReadState.value.loading,
    getAllError: getAllState.value.error,
    markAllError: markAllAsReadState.value.error,
    count: formattedNotifications.value.length,
  }), (state) => {
    if (loadingStateTimeout) {
      clearTimeout(loadingStateTimeout);
      loadingStateTimeout = undefined;
    }

    if (state.getAllLoading || state.markAllLoading) {
      isLoading.value = true;
      return;
    }

    if (state.getAllError || state.markAllError || state.count >= 0) {
      loadingStateTimeout = setTimeout(() => {
        isLoading.value = false;
      }, 500);
    }
  }, { immediate: true });

  /* * Data * */
  const notificationUserData = computed(() => {
    const source = formattedNotifications.value || [];
    const result: INotification[] = [];
    for (let i = 0; i < source.length; i++) {
      const item = source[i];
      if (item.type !== 'internal') {
        result.push(item);
      }
    }
    return result;
  });
  const notificationUserLength = computed(() => notificationUserData.value.length);
  const notificationUnreadData = computed(() => {
    const source = notificationUserData.value;
    const result: INotification[] = [];
    for (let i = 0; i < source.length; i++) {
      const item = source[i];
      if (item.status === 'unread') {
        result.push(item);
      }
    }
    return result;
  });
  const notificationUnreadLength = computed(() => notificationUnreadData.value.length);

  /* * Loading All Data * */
  const conditionToLoadAllData = computed(() => (
    !getAllState.value.loading && (formattedNotifications.value.length === 0)
    && !getAllState.value.error && userLoggedIn.value));

  const loadData = () => {
    if (conditionToLoadAllData.value) {
      void loadAll();
    }
  };

  watch(() => conditionToLoadAllData.value, () => {
    if (!getAllState.value.data && conditionToLoadAllData.value) {
      loadData();
    }
  });

  /* * Page Settings * */
  const filterSettings = ref([
    {
      value: 'status',
      title: 'By status:',
      options: [
        'Read',
        'Unread',
      ],
      model: [] as string[],
    },
    {
      value: 'type',
      title: 'By tag:',
      options: [
        'Investment',
        'System',
        'Tax Document/Offer Update',
        'Profile',
        'Wallet',
      ],
      model: [] as string[],
    },
  ] as NotificationFilter[]);

  const tabsSettingsBase = [
    {
      value: 'all',
      label: 'All',
    },
    {
      value: 'investments',
      label: 'Investments',
    },
    {
      value: 'accounts',
      label: 'Investment Profiles',
      labelMobile: 'Profiles',
    },
    {
      value: 'document',
      label: 'Documents',
    },
  ];

  const tabsSettings = computed(() => tabsSettingsBase.map((tab) => ({
    ...tab,
    label: tab.labelMobile && isTablet.value ? tab.labelMobile : tab.label,
  })));
  const currentTab = ref(tabsSettingsBase[0].value);
  const search = ref('');
  const filterStatus = ref<string[]>([]);
  const filterType = ref<string[]>([]);

  const tabsData = computed(() => {
    const source = notificationUserData.value;
    if (currentTab.value === 'all') {
      return source;
    }
    const result: INotification[] = [];
    for (let i = 0; i < source.length; i++) {
      const item = source[i];
      const type = (item.type || '').toLowerCase();
      if (currentTab.value === 'investments' && type.includes('investment')) {
        result.push(item);
      } else if (currentTab.value === 'accounts' && type.includes('profile')) {
        result.push(item);
      } else if (currentTab.value === 'document' && type.includes('document')) {
        result.push(item);
      }
    }
    return result;
  });

  const filterData = computed(() => {
    const source = tabsData.value;
    const hasStatusFilter = Boolean(filterStatus.value?.length);
    const hasTypeFilter = Boolean(filterType.value?.length);
    if (!hasStatusFilter && !hasTypeFilter) {
      return source;
    }

    const result: INotification[] = [];
    for (let i = 0; i < source.length; i++) {
      const item = source[i];
      const itemStatus = (item.status || '').toLowerCase();
      const itemType = (item.type || '').toLowerCase();

      if (hasTypeFilter && !filterType.value.includes(itemType)) continue;
      if (hasStatusFilter && !filterStatus.value.includes(itemStatus)) continue;
      result.push(item);
    }

    return result;
  });

  const tableData = computed(() => {
    // Only show loading state if we're loading AND don't have any existing data
    // AND we're not just filtering existing data
    if (isLoading.value) {
      return Array(10).fill({
        status: '',
        type: '',
        content: '',
      });
    }

    // Access the value of search
    const searchValue = search.value ? String(search.value).toLowerCase() : '';

    if (searchValue) {
      const filtered = filterData.value?.filter((item) => (
        (item.status.toLowerCase().includes(searchValue))
      || (item.type.toLowerCase().includes(searchValue))
      || (item.content.toLowerCase().includes(searchValue))
      ));
      return filtered;
    }
    // Ensure confirmedOffers is returned when search is falsy
    return filterData.value;
  });

  const filterResults = computed(() => tableData.value?.length);
  const showSearch = computed(() => notificationUserData.value.length > 0);
  const showFilter = computed(() => notificationUserData.value.length > 0);
  const showFilterPagination = computed(() => (
    Boolean(notificationUserLength.value && (notificationUserLength.value > 0) && (filterResults.value > 0))));
  const showMarkAll = computed(() => (filterResults.value > 0 && (notificationUnreadLength.value > 0)));

  const markAllAsRead = async () => {
    try {
      await markAllAsReadRequest();
    } catch (e) {
      reportError(e, 'Failed to mark all as read');
    }
  };

  const onApplyFilter = (items: NotificationFilter[]) => {
    filterSettings.value = items;

    const statusObject = items?.filter((item: NotificationFilter) => item.value === 'status')[0];
    if (!statusObject) {
      filterStatus.value = [];
    } else {
      filterStatus.value = statusObject?.model?.map((item: string) => item.toLowerCase());
    }

    const typeObject = items?.filter((item: NotificationFilter) => item.value === 'type')[0];
    if (!typeObject) {
      filterType.value = [];
    } else {
      filterType.value = typeObject?.model?.map((item: string) => item.toLowerCase());
    }
  };

  const clearFilterType = () => {
    filterType.value = [];
    if (filterSettings.value[1]) {
      filterSettings.value[1].model = [];
    }
  };
  const clearFilterStatus = () => {
    filterStatus.value = [];
    if (filterSettings.value[0]) {
      filterSettings.value[0].model = [];
    }
  };
  const clearTab = () => {
    currentTab.value = tabsSettings.value[0].value;
  };
  const clearSearch = () => {
    search.value = '';
  };

  const handleTabChange = () => {
    clearSearch();
    if (currentTab.value !== 'all') {
      clearFilterType();
    }
  };

  watch(() => search.value, () => {
    if (search.value) {
      clearFilterType();
      clearFilterStatus();
      clearTab();
    }
  });

  watch(() => filterSettings.value[1].model.length, () => {
    if (filterSettings.value[1].model.length > 0) {
      clearSearch();
      clearTab();
    }
  });
  watch(() => currentTab.value, () => {
    handleTabChange();
  });

  /* * Sidebar * */
  const isSidebarOpen = ref(false);
  const onSidebarToggle = (value: boolean) => {
    isSidebarOpen.value = value;
  };

  /* * Mark As Read By Id * */
  const markAsReadById = async (id: number) => {
    if (!id) {
      return;
    }
    await markAsReadByIdRequest(id);
  };

  return {
    isLoading,
    formattedNotifications,
    unreadNotificationsCount,
    getAllState,
    markAllAsReadState,
    markAsReadByIdState,
    notificationUnreadLength,
    notificationsHref,
    loadAll,
    loadData,
    markAllAsRead,
    filterSettings,
    tabsSettings,
    currentTab,
    search,
    showSearch,
    showFilter,
    filterResults,
    notificationUserLength,
    showMarkAll,
    tableData,
    onApplyFilter,
    showFilterPagination,
    onSidebarToggle,
    isSidebarOpen,
    markAsReadById,
    updateNotificationsData,
    resetAll,
    clearFilterType,
    clearFilterStatus,
    clearSearch,
    clearTab,
    // Expose state properties for testing
    filterStatus,
    filterType,
    // Expose computed properties for testing
    notificationUserData,
    tabsData,
    filterData,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNotifications, import.meta.hot));
}
