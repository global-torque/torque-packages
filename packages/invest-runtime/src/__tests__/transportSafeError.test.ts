import { describe, expect, it } from 'vitest';

import { createRuntimeTransportSafeError } from '../error/transportSafeError.ts';

describe('runtime transport-safe error adapter', () => {
  it('uses the public body-free contract and removes every canary from transport', () => {
    const transport = createRuntimeTransportSafeError(
      {
        message:
          'token=CANARY_SECRET for user@example.test card 123456789012',
        code: 'E_CANARY',
        statusCode: 500,
      },
      'Bearer CANARY_SECRET',
      {
        source: 'api',
        component: 'WalletView',
        route: '/profile/7/wallet?token=CANARY_SECRET#private',
        request: {
          method: 'POST',
          url: 'https://user:CANARY_SECRET@example.test/api?token=CANARY_SECRET#private',
        },
        stack: [
          'RuntimeClientError: token=CANARY_SECRET',
          '    at https://example.test/app.js?token=CANARY_SECRET#private:1:2',
        ],
      },
    );
    const serialized = JSON.stringify(transport);

    expect(serialized).not.toContain('CANARY_SECRET');
    expect(serialized).not.toContain('user@example.test');
    expect(serialized).not.toContain('123456789012');
    expect(transport.fingerprint).toMatch(/^ceh_[a-f0-9]{16}$/);
    expect(transport.context).toMatchObject({
      route: '/profile/7/wallet',
      component: 'WalletView',
      request: {
        method: 'POST',
        url: 'https://example.test/api',
      },
      metadata: {
        source: 'api',
        code: 'E_CANARY',
        statusCode: 500,
      },
    });
    expect(serialized).not.toContain('body');
  });
});
