import { useInvestWidgetProviders } from '../providers.ts';
import type { ProfileSwitchMenuItem } from '../providers.ts';

export type { ProfileSwitchMenuItem };

export function useProfileSwitchMenu() {
  return useInvestWidgetProviders().profiles.useProfileSwitchMenu();
}
