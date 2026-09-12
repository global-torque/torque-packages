import type {
  KycThirdPartyScreenModel,
  KycThirdPartyStatus,
} from './status.ts';

const FALLBACK_SCREEN: KycThirdPartyScreenModel = {
  title: 'We could not complete identity verification',
  description: 'Please retry from the original verification link. If the problem continues, contact support.',
};

const SCREEN_BY_STATUS: Record<KycThirdPartyStatus, KycThirdPartyScreenModel> = {
  idle: FALLBACK_SCREEN,
  launching: {
    title: 'Opening identity verification',
    description: 'Please wait while we connect you to our verification partner.',
  },
  success: {
    title: 'Thank you for completing KYC',
    description: 'Your KYC process is now complete.',
  },
  incomplete: FALLBACK_SCREEN,
  invalidToken: FALLBACK_SCREEN,
  error: FALLBACK_SCREEN,
};

export function formatKycThirdPartyScreen(status: KycThirdPartyStatus): KycThirdPartyScreenModel {
  return SCREEN_BY_STATUS[status];
}
