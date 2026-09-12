import { InvestKycTypes as InvestKycTypesValue } from '@webdevelop-pro/domain-types/kycTypes';
import type { InvestKycTypes as InvestKycStatus } from '@webdevelop-pro/domain-types/kycTypes';

export { InvestKycTypes } from '@webdevelop-pro/domain-types/kycTypes';

export type KycAlertVariant = 'error' | 'info';

export type KycThirdPartyStatus =
  | 'idle'
  | 'launching'
  | 'success'
  | 'incomplete'
  | 'invalidToken'
  | 'error';

export interface KycAlertModel {
  show: boolean;
  variant: KycAlertVariant;
  title: string;
  description: string;
  buttonText?: string;
  isLoading: boolean;
  isDisabled: boolean;
}

export interface KycThirdPartyScreenModel {
  title: string;
  description: string;
}

export interface KycTextStatus {
  text: string;
  class: string;
  button?: boolean;
  tooltip?: string;
  mobileText?: string;
}

export interface KycAlertContent {
  title: string;
  class: string;
  description: string;
  button?: boolean;
  tooltip?: string;
}

const VERIFY_IDENTITY_TEXT: KycTextStatus = {
  text: 'Verify Identity',
  mobileText: 'Verify',
  class: 'none',
  button: true,
};

const VERIFY_IDENTITY_ALERT: KycAlertContent = {
  title: 'Verify Identity',
  description: 'Complete identity verification to unlock investing access for this profile.',
  class: 'none',
  button: true,
};

export const KycTextStatuses: Record<InvestKycStatus, KycTextStatus> = {
  [InvestKycTypesValue.none]: VERIFY_IDENTITY_TEXT,
  [InvestKycTypesValue.new]: VERIFY_IDENTITY_TEXT,
  [InvestKycTypesValue.declined]: {
    text: 'Declined',
    class: 'failed',
  },
  [InvestKycTypesValue.pending]: {
    text: 'Continue',
    class: 'pending',
    button: true,
  },
  [InvestKycTypesValue.in_progress]: {
    text: 'Verification In Progress',
    mobileText: 'In Progress',
    class: 'pending',
    tooltip: 'Pending until all associated parties complete KYC.',
  },
  [InvestKycTypesValue.approved]: {
    text: 'Verified',
    class: 'success',
  },
};

export const KycAlerts: Record<InvestKycStatus, KycAlertContent> = {
  [InvestKycTypesValue.none]: VERIFY_IDENTITY_ALERT,
  [InvestKycTypesValue.new]: VERIFY_IDENTITY_ALERT,
  [InvestKycTypesValue.pending]: {
    title: 'Finish Your KYC',
    description: 'Complete the remaining identity verification steps so we can continue reviewing your submission.',
    class: 'pending',
    button: true,
  },
  [InvestKycTypesValue.in_progress]: {
    title: 'Verification In Progress',
    description: 'Your KYC review is in progress. We will notify you as soon as there is an update.',
    class: 'pending',
  },
  [InvestKycTypesValue.declined]: {
    title: 'Verification Declined',
    description: 'Your identity verification was declined. <a href="#contact-us-dialog" class="is--link-1" data-action="contact-us">Contact support</a> and we will help resolve the issue.',
    class: 'failed',
  },
  [InvestKycTypesValue.approved]: {
    title: 'Identity Verified',
    description: 'Your identity has been successfully verified for this investment profile.',
    class: 'success',
  },
};
