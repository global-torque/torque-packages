import { describe, expect, it } from 'vitest';
import {
  buildProfileCreationHandoff,
  buildWalletOnboardingIntent,
  parseExactOrigin,
  parseLocalContinuation,
  parsePositiveProfileId,
  parseSignupProfileType,
  parseWalletOnboardingProfileType,
} from '../intents';

describe('onboarding intent parsing', () => {
  it.each(['individual', 'entity', 'trust'])('accepts signup profile type %s', (value) => {
    expect(parseSignupProfileType(value)).toBe(value);
  });

  it.each(['sdira', 'solo401k', '', 'entity<script>'])('rejects closed profile value %s', (value) => {
    expect(parseSignupProfileType(value)).toBeNull();
  });

  it.each(['individual', 'entity', 'trust', 'sdira', 'solo401k'])(
    'accepts wallet-onboarding profile type %s',
    (value) => expect(parseWalletOnboardingProfileType(value)).toBe(value),
  );

  it.each([[1, 1], ['42', 42], ['profile_8', 8], ['profile:9', 9], ['investor-10', 10]])(
    'parses exact positive profile id %s',
    (value, expected) => expect(parsePositiveProfileId(value)).toBe(expected),
  );

  it.each([0, '0', -1, '1.5', 'profile_0', '1/next', Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid profile id %s',
    (value) => expect(parsePositiveProfileId(value)).toBeNull(),
  );

  it('allows only local allowlisted continuations', () => {
    expect(parseLocalContinuation('/profile/8/wallet-otp?next=1', ['/profile'], '/fallback'))
      .toBe('/profile/8/wallet-otp?next=1');
    for (const hostile of ['https://evil.test/x', '//evil.test/x', '/admin', '/profile\\evil']) {
      expect(parseLocalContinuation(hostile, ['/profile'], '/fallback')).toBe('/fallback');
    }
  });

  it('accepts exact configured origins without paths or credentials', () => {
    expect(parseExactOrigin('https://dashboard.example.test/path')).toBe('https://dashboard.example.test');
    expect(parseExactOrigin('https://user:pass@example.test')).toBeNull();
    expect(parseExactOrigin('javascript:alert(1)')).toBeNull();
  });

  it('builds exact wallet and entity handoff contracts', () => {
    expect(buildWalletOnboardingIntent({
      profileId: 'profile_7',
      profileType: 'sdira',
      nextPath: '/profile/7/kyc',
    })).toEqual({
      profileId: 7,
      expectedProfileType: 'sdira',
      nextPath: '/profile/7/kyc',
    });
    // Continuations outside /profile fall back to the profile account page.
    expect(buildWalletOnboardingIntent({
      profileId: 'profile_7',
      profileType: 'sdira',
      nextPath: '/investor/onboarding',
    })).toEqual({
      profileId: 7,
      expectedProfileType: 'sdira',
      nextPath: '/profile/7/account',
    });
    expect(buildProfileCreationHandoff({
      profileType: 'entity',
      nextPath: '/profile',
      acceptedProfileId: 'profile_11',
      firstName: ' Ada ',
    })).toEqual({
      onboarding: 'signup',
      profileType: 'entity',
      nextPath: '/profile',
      acceptedProfileId: 11,
      firstName: 'Ada',
    });
  });
});
