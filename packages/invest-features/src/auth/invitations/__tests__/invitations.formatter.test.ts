import { describe, expect, it } from 'vitest';
import {
  normalizeUserInvitationAcceptance,
  normalizeUserInvitationPreview,
} from '../invitations.formatter.ts';

describe('invitation formatters', () => {
  it('normalizes the minimized public preview response', () => {
    expect(normalizeUserInvitationPreview({
      kind: 'investor',
      email: 'invitee@example.test',
      firstName: 'Invite',
      lastName: 'Recipient',
      profileType: 'entity',
      expiresAt: '2030-01-01T00:00:00Z',
    })).toEqual({
      kind: 'investor',
      email: 'invitee@example.test',
      firstName: 'Invite',
      lastName: 'Recipient',
      profileType: 'entity',
      expiresAt: '2030-01-01T00:00:00Z',
    });
  });

  it('rejects malformed preview data instead of exposing a partial model', () => {
    expect(() => normalizeUserInvitationPreview({
      kind: 'investor',
      email: '',
      firstName: 'Invite',
      lastName: 'Recipient',
      profileType: 'entity',
      expiresAt: '2030-01-01T00:00:00Z',
    })).toThrow('Invitation response is invalid.');
  });

  // This rejection is what keeps signup from ever seeing an investor invitation
  // without a type, so the chooser stays reserved for direct signup.
  it.each([null, undefined, 'partnership'])(
    'rejects an investor preview whose profile type is %s',
    (profileType) => {
      expect(() => normalizeUserInvitationPreview({
        kind: 'investor',
        email: 'invitee@example.test',
        firstName: 'Invite',
        lastName: 'Recipient',
        profileType,
        expiresAt: '2030-01-01T00:00:00Z',
      })).toThrow('Invitation response is invalid.');
    },
  );

  it('allows team recipients to complete names during signup', () => {
    expect(normalizeUserInvitationPreview({
      kind: 'team',
      email: 'invitee@example.test',
      firstName: '',
      lastName: '',
      expiresAt: '2030-01-01T00:00:00Z',
    })).toMatchObject({
      kind: 'team',
      firstName: '',
      lastName: '',
      profileType: null,
    });
  });

  it('normalizes an exact investor acceptance profile', () => {
    expect(normalizeUserInvitationAcceptance({
      invitation: {
        kind: 'investor',
        acceptedProfileId: 'investor-73',
      },
      investor: {
        id: 'investor-73',
      },
      selectedProfileType: 'trust',
    })).toEqual({
      kind: 'investor',
      acceptedProfileId: 73,
      selectedProfileType: 'trust',
    });
  });

  it('accepts team responses without a profile', () => {
    expect(normalizeUserInvitationAcceptance({
      invitation: {
        kind: 'team',
      },
      member: {
        id: 'user-10',
      },
    })).toEqual({
      kind: 'team',
      acceptedProfileId: null,
      selectedProfileType: null,
    });
  });
});
