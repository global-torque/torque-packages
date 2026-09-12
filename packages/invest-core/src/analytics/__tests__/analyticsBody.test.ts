import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  normalizeAnalyticsBody,
  normalizeAnalyticsBodyForMethod,
} from '../analyticsBody';

describe('analyticsBody', () => {
  it('redacts sensitive fields in object payloads', () => {
    expect(normalizeAnalyticsBody({
      email: 'user@example.com',
      password: 'secret',
      code: '123456',
      nested: {
        routing_number: '021000021',
        note: 'Contact user@example.com before submitting',
        tokenNote: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwMTIzNDU2Nzg5MCJ9.signaturepart',
        keep: true,
      },
    })).toEqual({
      email: '[redacted]',
      password: '[redacted]',
      code: '[redacted]',
      nested: {
        routing_number: '[redacted]',
        note: 'Contact [redacted] before submitting',
        tokenNote: '[redacted]',
        keep: true,
      },
    });
  });

  it('normalizes JSON strings and ignores invalid string bodies', () => {
    expect(normalizeAnalyticsBody('{"first_name":"Jamie","keep":1}')).toEqual({
      first_name: '[redacted]',
      keep: 1,
    });
    expect(normalizeAnalyticsBody('not-json')).toEqual({});
  });

  it('only includes bodies for mutation methods', () => {
    expect(normalizeAnalyticsBodyForMethod('GET', { keep: true })).toEqual({});
    expect(normalizeAnalyticsBodyForMethod('POST', { keep: true })).toEqual({ redacted: true });
    expect(normalizeAnalyticsBodyForMethod('POST', undefined)).toEqual({});
    expect(normalizeAnalyticsBodyForMethod('POST', '')).toEqual({});
  });
});
