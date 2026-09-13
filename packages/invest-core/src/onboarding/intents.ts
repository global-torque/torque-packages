import {
  SIGNUP_PROFILE_TYPES,
  WALLET_ONBOARDING_PROFILE_TYPES,
  type ProfileCreationHandoff,
  type SignupProfileType,
  type WalletOnboardingIntent,
  type WalletOnboardingProfileType,
} from '@global-torque/domain-types/onboardingTypes';

const SIGNUP_PROFILE_TYPE_SET = new Set<string>(SIGNUP_PROFILE_TYPES);
const WALLET_PROFILE_TYPE_SET = new Set<string>(WALLET_ONBOARDING_PROFILE_TYPES);
const MAX_PREFILL_LENGTH = 100;

export const parseSignupProfileType = (value: unknown): SignupProfileType | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return SIGNUP_PROFILE_TYPE_SET.has(normalized)
    ? normalized as SignupProfileType
    : null;
};

export const parseWalletOnboardingProfileType = (
  value: unknown,
): WalletOnboardingProfileType | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return WALLET_PROFILE_TYPE_SET.has(normalized)
    ? normalized as WalletOnboardingProfileType
    : null;
};

export const parsePositiveProfileId = (value: unknown): number | null => {
  const normalized = String(value ?? '').trim().replace(/^(?:profile|investor)[_:-]/i, '');
  if (!/^[1-9]\d*$/.test(normalized)) {
    return null;
  }
  const profileId = Number(normalized);
  return Number.isSafeInteger(profileId) ? profileId : null;
};

export const parseLocalContinuation = (
  value: unknown,
  allowedPrefixes: readonly string[],
  fallback: string,
): string => {
  const candidate = String(value ?? '').trim();
  if (
    !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
    || /[\u0000-\u001f]/.test(candidate)
  ) {
    return fallback;
  }
  const pathname = candidate.split(/[?#]/, 1)[0] ?? '';
  return allowedPrefixes.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  )) ? candidate : fallback;
};

export const parseExactOrigin = (value: unknown): string | null => {
  try {
    const url = new URL(String(value ?? '').trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

export const boundedSignupPrefill = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return normalized && normalized.length <= MAX_PREFILL_LENGTH ? normalized : undefined;
};

export const buildWalletOnboardingIntent = ({
  profileId,
  profileType,
  nextPath,
}: {
  profileId: unknown;
  profileType: unknown;
  nextPath: unknown;
}): WalletOnboardingIntent | null => {
  const parsedId = parsePositiveProfileId(profileId);
  const parsedType = parseWalletOnboardingProfileType(profileType);
  if (!parsedId || !parsedType) {
    return null;
  }
  return {
    profileId: parsedId,
    expectedProfileType: parsedType,
    nextPath: parseLocalContinuation(nextPath, ['/profile'], `/profile/${parsedId}/account`),
  };
};

export const buildProfileCreationHandoff = ({
  profileType,
  nextPath,
  acceptedProfileId,
  firstName,
  lastName,
  email,
}: {
  profileType: unknown;
  nextPath: unknown;
  acceptedProfileId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
}): ProfileCreationHandoff | null => {
  const parsedType = parseSignupProfileType(profileType);
  if (parsedType !== 'entity' && parsedType !== 'trust') {
    return null;
  }
  const parsedAcceptedId = acceptedProfileId == null
    ? undefined
    : parsePositiveProfileId(acceptedProfileId) ?? undefined;
  return {
    onboarding: 'signup',
    profileType: parsedType,
    nextPath: parseLocalContinuation(nextPath, ['/profile'], '/profile'),
    ...(boundedSignupPrefill(firstName) && { firstName: boundedSignupPrefill(firstName) }),
    ...(boundedSignupPrefill(lastName) && { lastName: boundedSignupPrefill(lastName) }),
    ...(boundedSignupPrefill(email) && { email: boundedSignupPrefill(email) }),
    ...(parsedAcceptedId && { acceptedProfileId: parsedAcceptedId }),
  };
};
