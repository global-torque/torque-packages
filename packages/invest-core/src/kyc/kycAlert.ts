import {
  InvestKycTypes,
  KycAlerts,
  KycTextStatuses,
  type KycAlertModel,
} from './status.ts';

export interface KycAlertFormatterInput {
  isKycApproved?: boolean | null;
  isPlaidLoading?: boolean;
  status?: InvestKycTypes | null;
}

export const createHiddenKycAlertModel = (): KycAlertModel => ({
  show: false,
  variant: 'error',
  title: '',
  description: '',
  buttonText: undefined,
  isLoading: false,
  isDisabled: false,
});

export const formatKycAlertModel = ({
  isKycApproved = false,
  isPlaidLoading = false,
  status = InvestKycTypes.none,
}: KycAlertFormatterInput): KycAlertModel => {
  const resolvedStatus = status ?? InvestKycTypes.none;

  if (isKycApproved || resolvedStatus === InvestKycTypes.approved) {
    return createHiddenKycAlertModel();
  }

  const alert = KycAlerts[resolvedStatus];
  const statusText = KycTextStatuses[resolvedStatus];

  return {
    show: true,
    variant: resolvedStatus === InvestKycTypes.in_progress ? 'info' : 'error',
    title: alert.title,
    description: alert.description,
    buttonText: statusText.button ? statusText.text : undefined,
    isLoading: isPlaidLoading,
    isDisabled: isPlaidLoading,
  };
};
