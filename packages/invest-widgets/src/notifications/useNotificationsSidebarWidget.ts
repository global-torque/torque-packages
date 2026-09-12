import { useInvestWidgetProviders } from '../providers.ts';

export function useNotificationsSidebarWidget() {
  return useInvestWidgetProviders().notifications.useSidebar();
}
