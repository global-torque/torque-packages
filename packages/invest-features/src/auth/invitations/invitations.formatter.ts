import {
  WALLET_ONBOARDING_PROFILE_TYPES,
  type WalletOnboardingProfileType,
} from '@global-torque/domain-types/onboardingTypes';
import { parsePositiveProfileId } from '@global-torque/invest-core/onboarding/intents';
import type {
  UserInvitationAcceptance,
  UserInvitationKind,
  UserInvitationPreview,
} from './invitations.types.ts';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unwrapRecord(value: unknown): JsonRecord {
  if (!isRecord(value)) {
    throw new Error('Invitation response is invalid.');
  }
  return isRecord(value.data) ? value.data : value;
}

function requiredString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Invitation response is invalid.');
  }
  return value.trim();
}

function stringValue(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error('Invitation response is invalid.');
  }
  return value.trim();
}

function invitationKind(value: unknown): UserInvitationKind {
  if (value === 'team' || value === 'investor') {
    return value;
  }
  throw new Error('Invitation response is invalid.');
}

function walletProfileType(value: unknown): WalletOnboardingProfileType | null {
  if (value == null) {
    return null;
  }
  return WALLET_ONBOARDING_PROFILE_TYPES.includes(value as WalletOnboardingProfileType)
    ? value as WalletOnboardingProfileType
    : null;
}

export function normalizeUserInvitationPreview(payload: unknown): UserInvitationPreview {
  const record = unwrapRecord(payload);
  const kind = invitationKind(record.kind);
  const email = requiredString(record, 'email');
  if (!email.includes('@')) {
    throw new Error('Invitation response is invalid.');
  }
  const profileType = walletProfileType(record.profileType ?? record.profile_type);
  if (kind === 'investor' && !profileType) {
    throw new Error('Invitation response is invalid.');
  }

  const firstName = stringValue(record, 'firstName');
  const lastName = stringValue(record, 'lastName');
  if (kind === 'investor' && (!firstName || !lastName)) {
    throw new Error('Invitation response is invalid.');
  }

  return {
    kind,
    email,
    firstName,
    lastName,
    profileType: kind === 'investor' ? profileType : null,
    expiresAt: requiredString(record, 'expiresAt'),
  };
}

export function normalizeUserInvitationAcceptance(payload: unknown): UserInvitationAcceptance {
  const record = unwrapRecord(payload);
  const invitation = isRecord(record.invitation) ? record.invitation : {};
  const kind = invitationKind(
    record.kind
      ?? invitation.kind
      ?? (isRecord(record.investor) ? 'investor' : isRecord(record.member) ? 'team' : undefined),
  );
  const acceptedProfileId = parsePositiveProfileId(
    record.acceptedProfileId
      ?? record.accepted_profile_id
      ?? invitation.acceptedProfileId
      ?? invitation.accepted_profile_id,
  );
  const selectedProfileType = walletProfileType(
    record.selectedProfileType
      ?? record.selected_profile_type
      ?? invitation.selectedProfileType
      ?? invitation.selected_profile_type,
  );

  if (kind === 'investor' && (!acceptedProfileId || !selectedProfileType)) {
    throw new Error('Invitation acceptance did not return an exact profile.');
  }

  return {
    kind,
    acceptedProfileId,
    selectedProfileType,
  };
}
