import type { ProfileType } from './profileTypes.ts';

export const SIGNUP_PROFILE_TYPES = ['individual', 'entity', 'trust'] as const;

export type SignupProfileType = Extract<
  ProfileType,
  (typeof SIGNUP_PROFILE_TYPES)[number]
>;

export const WALLET_ONBOARDING_PROFILE_TYPES = [
  'individual',
  'entity',
  'trust',
  'sdira',
  'solo401k',
] as const;

export type WalletOnboardingProfileType = Extract<
  ProfileType,
  (typeof WALLET_ONBOARDING_PROFILE_TYPES)[number]
>;

export type DirectSignupIntent = {
  kind: 'direct-signup';
  profileType: SignupProfileType;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type InvitationSignupIntent = {
  kind: 'invitation-signup';
  invitationCode: string;
  recommendedProfileType: SignupProfileType;
  selectedProfileType: SignupProfileType;
  firstName: string;
  lastName: string;
  email: string;
};

export type WalletOnboardingIntent = {
  profileId: number;
  expectedProfileType: WalletOnboardingProfileType;
  nextPath: string;
};

export type ProfileCreationHandoff = {
  onboarding: 'signup';
  profileType: Exclude<SignupProfileType, 'individual'>;
  nextPath: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  acceptedProfileId?: number;
};
