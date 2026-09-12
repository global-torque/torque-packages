import { describe, expect, it } from 'vitest';
import {
  assertInvestRuntimeBrandConfig,
  createInvestAppConfigFromEnv,
  serializeStaticConfigForInlineScript,
  type InvestRuntimeBrandConfig,
} from './config.ts';

describe('createInvestAppConfigFromEnv', () => {
  const staticConfig: InvestRuntimeBrandConfig = {
    brand: {
      profile: 'example', title: 'Example Invest', description: 'Example investments.',
      email: 'invest@example.test', logo: '/brand/example.svg',
      logoReversed: '/brand/example-reversed.svg', mark: '/brand/example-mark.svg',
      pwaName: 'Example Investor',
    },
    contact: {
      address1: 'USA', address2: 'Example City', phone: '+1 555 0100', email: 'invest@example.test',
    },
    socials: {
      example: { icon: '/brand/social.svg', iconName: 'example', name: 'Example', href: 'https://social.example.test' },
    },
  };

  it('maps a host-owned environment without reading ambient globals', () => {
    const config = createInvestAppConfigFromEnv({
      ENV: 'stage',
      DEV: 'true',
      IS_STATIC_SITE: '1',
      FRONTEND_URL_DASHBOARD: 'https://dashboard.example.test',
      EVM_URL: 'https://evm.example.test/',
      STABLE_COIN: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
    }, staticConfig);

    expect(config.env).toBe('stage');
    expect(config.isDev).toBe(true);
    expect(config.isStaticSite).toBe(true);
    expect(config.urls.dashboard).toBe('https://dashboard.example.test');
    expect(config.stableCoinAddress).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    expect(config.brand).toMatchObject({
      profile: 'example',
      title: 'Example Invest',
      logo: '/brand/example.svg',
      pwaName: 'Example Investor',
    });
    expect(config.thirdParty.turnkeyServerSignUrl)
      .toBe('https://evm.example.test/auth/turnkey/server-sign');
  });

  it('rejects missing and blank required brand values', () => {
    expect(() => assertInvestRuntimeBrandConfig(undefined))
      .toThrow('runtime');
    expect(() => assertInvestRuntimeBrandConfig({
      ...staticConfig,
      brand: { ...staticConfig.brand, title: '   ' },
    })).toThrow('runtime.brand.title');
  });

  it('rejects incomplete runtime identity with precise paths', () => {
    expect(() => assertInvestRuntimeBrandConfig({
      ...staticConfig,
      contact: { ...staticConfig.contact, phone: ' ' },
    })).toThrow('runtime.contact.phone');
    expect(() => assertInvestRuntimeBrandConfig({
      ...staticConfig,
      socials: { example: { ...staticConfig.socials.example, icon: '' } },
    })).toThrow('runtime.socials.example.icon');
  });

  it('rejects malformed stable-coin addresses', () => {
    expect(() => createInvestAppConfigFromEnv({ STABLE_COIN: '0x1234' }, staticConfig))
      .toThrow('20-byte');
  });

  it('serializes inline config without allowing script-tag breakout', () => {
    expect(serializeStaticConfigForInlineScript({ title: '</script><script>alert(1)</script>' }))
      .not.toContain('</script>');
  });
});
