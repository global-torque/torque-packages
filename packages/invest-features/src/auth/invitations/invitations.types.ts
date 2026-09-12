import type {
  WalletOnboardingProfileType,
} from '@webdevelop-pro/domain-types/onboardingTypes';

export type UserInvitationKind = 'team' | 'investor';

export interface UserInvitationPreview {
  kind: UserInvitationKind;
  email: string;
  firstName: string;
  lastName: string;
  profileType: WalletOnboardingProfileType | null;
  expiresAt: string;
}

export interface UserInvitationAcceptance {
  kind: UserInvitationKind;
  acceptedProfileId: number | null;
  selectedProfileType: WalletOnboardingProfileType | null;
}
