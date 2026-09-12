import { describe, expect, it } from 'vitest';
import {
  buildCanonicalInvitationPath,
  buildCanonicalInvitationUrl,
  parseInvitationCode,
  recoverInvitationCode,
  recoverInvitationCodeFromReturn,
  recoverRememberedInvitationReturn,
  rememberInvitationReturnForFlow,
  validateLocalPostAuthReturnPath,
} from '../invitationReturn.ts';

const origin = 'https://invest.example.test';

describe('invitation return navigation', () => {
  it('preserves the decoded code exactly and encodes one canonical value', () => {
    const code = ' opaque / code +? ';
    const path = buildCanonicalInvitationPath(code);

    expect(path).toBe('/signup?invite=+opaque+%2F+code+%2B%3F+');
    expect(parseInvitationCode(new URL(path!, origin))).toBe(code);
    expect(buildCanonicalInvitationUrl(code, origin)).toBe(`${origin}${path}`);
  });

  it.each([
    '/signup',
    '/signup?invite=',
    '/signup?invite=one&invite=two',
    `/signup?invite=${'x'.repeat(513)}`,
    'https://evil.example/signup?invite=one',
    'https://user:password@invest.example.test/signup?invite=one',
    '/signin?invite=one',
  ])('rejects an invalid invitation return: %s', (value) => {
    expect(recoverInvitationCodeFromReturn(value, origin)).toBeNull();
  });

  it('recovers a validated Ory flow return when no top-level invitation exists', () => {
    expect(recoverInvitationCode({
      currentUrl: `${origin}/signup`,
      flowReturnTo: `${origin}/signup?invite=flow-code`,
      origin,
    })).toBe('flow-code');
  });

  it('allows same-origin MFA returns and rejects external or protocol-relative targets', () => {
    expect(validateLocalPostAuthReturnPath('/signup?invite=one', origin))
      .toBe('/signup?invite=one');
    expect(validateLocalPostAuthReturnPath('https://evil.example/path', origin)).toBeNull();
    expect(validateLocalPostAuthReturnPath('//evil.example/path', origin)).toBeNull();
  });

  it('recovers a canonical invitation for an expired flow only when the flow id matches', () => {
    sessionStorage.clear();
    rememberInvitationReturnForFlow({
      flowId: 'flow-one',
      invitationReturn: `${origin}/signup?invite=flow-code`,
      origin,
    });

    expect(recoverRememberedInvitationReturn({ flowId: 'flow-one', origin }))
      .toBe('/signup?invite=flow-code');
    expect(recoverRememberedInvitationReturn({ flowId: 'flow-two', origin })).toBeNull();
  });
});
