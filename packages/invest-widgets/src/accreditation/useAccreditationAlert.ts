import { useInvestWidgetProviders } from '../providers.ts';

export function useAccreditationAlert() {
  return useInvestWidgetProviders().accreditation.useAlert();
}

export function useAccreditationButton() {
  return useInvestWidgetProviders().accreditation.useButton();
}
