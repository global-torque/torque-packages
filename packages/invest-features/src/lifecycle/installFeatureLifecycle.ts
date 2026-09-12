import {
  registerFullResetTarget,
  registerLogoutRequestHandler,
  registerProfileResetTarget,
} from '@webdevelop-pro/invest-runtime/lifecycle';
import { configureInvestRuntimeAdapters } from '@webdevelop-pro/invest-runtime/adapters';
import { useLogoutStore } from '../auth/store/useLogout.ts';
import {
  resetInvestWidgetProvidersForTests,
  setInvestWidgetProviders,
  type InvestWidgetProviders,
} from '@webdevelop-pro/invest-widgets/providers';
import { storeToRefs } from 'pinia';
import { useNotifications } from '../notifications/useNotifications.ts';
import { NotificationFormatter } from '../notifications/notificationFormatter.ts';
import VNotificationBadge from '../notifications/components/VNotificationBadge.vue';
import VNotificationSidebar from '../notifications/components/VNotificationSidebar.vue';
import { getInvestDataAppLinks } from '@webdevelop-pro/invest-data/service/dataClientConfig';
import { useAccreditationAlert } from '../accreditation/logic/useAccreditationAlert.ts';
import { useAccreditationStatus } from '../accreditation/store/useAccreditationStatus.ts';
import { useAccreditationModel } from '../accreditation/useAccreditationModel.ts';
import { useKycAlertViewModel } from '../kyc/logic/useKycAlertViewModel.ts';
import { useKycModel } from '../kyc/model/useKycModel.ts';
import { useRepositoryOffer } from '../offers/data/offer.repository.ts';
import { useRepositoryProfiles } from '../profiles/model/profiles.repository.ts';
import { useInvestApplicationContext } from '@webdevelop-pro/invest-runtime/application-context';
import { useFilerModel } from '@webdevelop-pro/invest-runtime/filer';
import { reportError } from '@webdevelop-pro/invest-runtime/error/errorReporting';

let installed = false;

export const installInvestmentFeatureLifecycle = (
  widgetProviders: Partial<InvestWidgetProviders> = {},
) => {
  const notifications = useNotifications();
  const { isSidebarOpen } = storeToRefs(notifications as any) as any;
  setInvestWidgetProviders({
    filer: {
      getCurrentUserId: () => {
        const userId = (useRepositoryProfiles() as any).getUserState.data?.id;
        return Number.isSafeInteger(userId) && Number(userId) > 0 ? Number(userId) : undefined;
      },
      getFilerUrl: () => useInvestApplicationContext().appConfig.urls.api.filer ?? '',
      uploadFile: (file, options) => useFilerModel().uploadFile(file, options),
      reportError,
    },
    accreditation: {
      useAlert: useAccreditationAlert,
      useButton: () => {
        const status = useAccreditationStatus();
        const { data, tagBackground } = storeToRefs(status as any) as any;
        return { data, tagBackground, onClick: status.onClick };
      },
    },
    kyc: {
      useAlert: useKycAlertViewModel,
    },
    notifications: {
      useSidebar: () => ({
        BadgeComponent: VNotificationBadge,
        SidebarComponent: VNotificationSidebar,
        loadData: notifications.loadData,
        onSidebarToggle: notifications.onSidebarToggle,
        isSidebarOpen,
      }),
    },
    ...widgetProviders,
  } as InvestWidgetProviders);

  configureInvestRuntimeAdapters({
    accreditation: {
      getModel: () => useAccreditationModel() as any,
    },
    kyc: {
      getModel: () => useKycModel() as any,
    },
    offer: {
      getModel: () => useRepositoryOffer() as any,
    },
    notifications: {
      updateNotificationsData: notifications.updateNotificationsData,
      refreshNotifications: async () => { await notifications.loadAll(); },
      formatNotificationHref: notification => new NotificationFormatter(notification as never).format().buttonHref,
      fallbackHref: () => getInvestDataAppLinks().notifications,
    },
  });

  if (installed) {
    return;
  }

  registerFullResetTarget('notifications', () => notifications.resetAll());
  registerProfileResetTarget('accreditation', () => useAccreditationModel().resetAll());
  registerProfileResetTarget('kyc', () => useKycModel().resetAll());
  registerFullResetTarget('offers', () => useRepositoryOffer().resetAll());
  registerLogoutRequestHandler('auth-logout', async (options) => {
    await useLogoutStore().logoutHandler(options);
  });

  installed = true;
};

export const resetInvestmentFeatureLifecycleForTests = () => {
  installed = false;
  resetInvestWidgetProvidersForTests();
};
