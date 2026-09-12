import { useInvestWidgetProviders } from '../providers.ts';

export function useKycAlertViewModel() {
  return useInvestWidgetProviders().kyc.useAlert();
}
