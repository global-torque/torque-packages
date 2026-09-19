import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  normalizeAnalyticsBody,
  normalizeAnalyticsBodyForMethod,
  sanitizeAnalyticsText,
  sanitizeAnalyticsUrl,
} from '../analyticsBody';

describe('analyticsBody', () => {
  it('removes exact credential fields while preserving user and business data', () => {
    const input = {
      email: 'user@example.com',
      firstName: 'Jamie',
      address: '42 Main Street',
      longId: '12345678901234567890',
      token_symbol: 'USDC',
      token_count: 12,
      tokenNote: 'token is a business concept here',
      password: 'secret',
      nested: {
        jwtToken: 'jwt-secret',
        auth_code: 'auth-secret',
        status_code: 200,
        note: 'Contact user@example.com before submitting',
      },
    };

    expect(normalizeAnalyticsBody(input)).toEqual({
      email: 'user@example.com',
      firstName: 'Jamie',
      address: '42 Main Street',
      longId: '12345678901234567890',
      token_symbol: 'USDC',
      token_count: 12,
      tokenNote: 'token is a business concept here',
      password: '[redacted]',
      nested: {
        jwtToken: '[redacted]',
        auth_code: '[redacted]',
        status_code: 200,
        note: 'Contact user@example.com before submitting',
      },
    });
    expect(input.password).toBe('secret');
    expect(input.nested.jwtToken).toBe('jwt-secret');
  });

  it('normalizes JSON strings and retains GET bodies', () => {
    expect(normalizeAnalyticsBody('{"email":"user@example.com","token":"secret","keep":1}')).toEqual({
      email: 'user@example.com',
      token: '[redacted]',
      keep: 1,
    });
    expect(normalizeAnalyticsBody('not-json')).toEqual({});
    expect(normalizeAnalyticsBodyForMethod('GET', { keep: true })).toEqual({ keep: true });
    expect(normalizeAnalyticsBodyForMethod('POST', { keep: true })).toEqual({ keep: true });
    expect(normalizeAnalyticsBodyForMethod('POST', undefined)).toEqual({});
  });

  it('redacts code only for the known csrf authentication record shape', () => {
    expect(normalizeAnalyticsBody({ method: 'code', csrf_token: 'csrf', code: 'one', state: 'two' })).toEqual({
      method: 'code',
      csrf_token: '[redacted]',
      code: '[redacted]',
      state: 'two',
    });
    expect(normalizeAnalyticsBody({ method: 'code', code: 'keep', state: 'two' })).toEqual({
      method: 'code',
      code: 'keep',
      state: 'two',
    });
    expect(normalizeAnalyticsBody({ method: 'code', csrf_token: 'csrf', status_code: 200 })).toEqual({
      method: 'code',
      csrf_token: '[redacted]',
      status_code: 200,
    });

    expect(normalizeAnalyticsBody('{"method":"code","csrfToken":"csrf","code":"one","state":"two"}')).toEqual({
      method: 'code',
      csrfToken: '[redacted]',
      code: '[redacted]',
      state: 'two',
    });
  });

  it('preserves duplicate FormData and URLSearchParams values while masking credentials', () => {
    const formData = new FormData();
    formData.append('email', 'user@example.com');
    formData.append('email', 'second@example.com');
    formData.append('method', 'code');
    formData.append('csrf_token', 'csrf');
    formData.append('code', 'one');
    formData.append('code', 'two');
    expect(normalizeAnalyticsBody(formData)).toMatchObject({
      email: ['user@example.com', 'second@example.com'],
      method: 'code',
      csrf_token: '[redacted]',
      code: ['[redacted]', '[redacted]'],
    });

    const params = new URLSearchParams();
    params.append('email', 'user@example.com');
    params.append('email', 'second@example.com');
    params.append('token_symbol', 'USDC');
    params.append('token', 'secret');
    expect(normalizeAnalyticsBody(params)).toEqual({
      email: ['user@example.com', 'second@example.com'],
      token_symbol: 'USDC',
      token: '[redacted]',
    });

    const authParams = new URLSearchParams('method=code&csrf_token=csrf&code=one&code=two&state=state');
    expect(normalizeAnalyticsBody(authParams)).toEqual({
      method: 'code',
      csrf_token: '[redacted]',
      code: ['[redacted]', '[redacted]'],
      state: 'state',
    });
  });

  it('handles cycles before arrays and preserves binary markers', () => {
    const value: Record<string, unknown> = { name: 'user@example.com' };
    const array: unknown[] = [];
    array.push(array);
    value.array = array;
    value.file = new Blob(['contents']);
    expect(normalizeAnalyticsBody(value)).toEqual({
      name: 'user@example.com',
      array: ['[circular]'],
      file: '[binary]',
    });
  });

  it('selectively preserves URL context and masks credential locations', () => {
    const url = 'https://user:pass@example.test/path/token/CANARY?%74oken=CANARY&email=user@example.test&tag=one&tag=two#section';
    const sanitized = sanitizeAnalyticsUrl(url);
    expect(sanitized).toContain('https://example.test/path/token/[redacted]');
    expect(sanitized).toContain('email=user%40example.test');
    expect(sanitized).toContain('tag=one&tag=two');
    expect(sanitized).toContain('#section');
    expect(sanitized).not.toContain('CANARY');
  });

  it('sanitizes credential assignments and bearer values without broad PII matching', () => {
    const text = 'user@example.com amount=123456789012 tokenNote=keep token=CANARY url=https://example.test/path?token=CANARY&email=user@example.com';
    const sanitized = sanitizeAnalyticsText(text);
    expect(sanitized).toContain('user@example.com');
    expect(sanitized).toContain('123456789012');
    expect(sanitized).toContain('tokenNote=keep');
    expect(sanitized).not.toContain('token=CANARY');
    expect(sanitized).not.toContain('?token=CANARY');
    expect(sanitizeAnalyticsText('Failed /offers?%74oken=CANARY&email=user@example.test'))
      .toBe('Failed /offers?token=%5Bredacted%5D&email=user%40example.test');
    expect(sanitizeAnalyticsText('Open ../offers?email=user@example.test'))
      .toBe('Open ../offers?email=user%40example.test');
    expect(normalizeAnalyticsBody({
      redirect_url: '/auth?%74oken=CANARY&email=user@example.test',
    })).toEqual({
      redirect_url: '/auth?token=%5Bredacted%5D&email=user%40example.test',
    });
  });

  it('sanitizes nested text assignments and exact credential headers only', () => {
    expect(sanitizeAnalyticsText('{"nested":{"password":"TEST_SECRET"},"email":"user@example.com"}'))
      .toBe('{"nested":{"password":"[redacted]"},"email":"user@example.com"}');
    expect(sanitizeAnalyticsText('https://host/path#%74oken=TEST_SECRET&tab=activity'))
      .toBe('https://host/path#token=%5Bredacted%5D&tab=activity');
    expect(sanitizeAnalyticsText('Cookie: session=TEST_SECRET; next=SECOND_SECRET'))
      .toBe('Cookie: [redacted]');
    expect(sanitizeAnalyticsText('preferred-cookie: chocolate email=user@example.com'))
      .toBe('preferred-cookie: chocolate email=user@example.com');
    expect(sanitizeAnalyticsText('message="failed password=CANARY for a@example.test"'))
      .toBe('message="failed password=[redacted] for a@example.test"');
    expect(sanitizeAnalyticsText('{"authorization":"Bearer CANARY","password":"SECOND_SECRET","email":"user@example.com"}'))
      .toBe('{"authorization":"Bearer [redacted]","password":"[redacted]","email":"user@example.com"}');
    expect(sanitizeAnalyticsText('{"proxy_authorization":"Basic CANARY","token":"SECOND_SECRET","email":"user@example.com"}'))
      .toBe('{"proxy_authorization":"Basic [redacted]","token":"[redacted]","email":"user@example.com"}');
    expect(sanitizeAnalyticsText('password="prefix[redacted]SECRET" token=abc%5Bredacted%5DSECRET'))
      .toBe('password="[redacted]" token=[redacted]');
  });
});
