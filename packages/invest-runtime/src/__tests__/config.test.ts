import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { InvestAppConfig } from '@webdevelop-pro/invest-core/app/config';
import {
  createPwaPolicyEnvFromInvestAppConfig,
  getInvestRuntimeClientServiceName,
  getInvestRuntimeLinks,
  isInvestRuntimeFlagEnabled,
  resetInvestRuntimeConfigForTests,
  setInvestRuntimeClientServiceName,
  setInvestRuntimeConfig,
} from '../config.ts';

const createConfig = (): InvestAppConfig => ({
  env: 'test',
  isDev: true,
  isStaticSite: true,
  enableAnalytics: true,
  cookieDomain: '.example.test',
  urls: {
    frontend: 'https://app.example.test',
    dashboard: 'https://dashboard.example.test',
    static: 'https://static.example.test',
    api: {
      user: 'https://user.example.test',
      offer: 'https://offer.example.test',
      investment: 'https://investment.example.test',
      wallet: 'https://wallet.example.test',
      evm: 'https://evm.example.test',
      filer: 'https://filer.example.test',
      distributions: 'https://distributions.example.test',
      accreditation: 'https://accreditation.example.test',
      kratos: 'https://kratos.example.test',
    },
  },
  brand: {
    title: 'Global Torque',
    description: 'Invest',
  },
  thirdParty: {},
});

describe('invest runtime config', () => {
  afterEach(() => {
    resetInvestRuntimeConfigForTests();
  });

  it('derives PWA policy env from app config', () => {
    const env = createPwaPolicyEnvFromInvestAppConfig(createConfig());

    expect(env.USER_URL).toBe('https://user.example.test');
    expect(env.OFFER_URL).toBe('https://offer.example.test');
  });

  it('stores runtime config for flags and links', () => {
    setInvestRuntimeConfig(createConfig());

    expect(isInvestRuntimeFlagEnabled('ENABLE_ANALYTICS')).toBe(true);
    expect(isInvestRuntimeFlagEnabled('IS_STATIC_SITE')).toBe(true);
    expect(getInvestRuntimeLinks().signin).toBe('https://static.example.test/signin');
  });

  it('stores and resets the frontend client service name', () => {
    setInvestRuntimeClientServiceName('dashboard');
    expect(getInvestRuntimeClientServiceName()).toBe('dashboard');

    resetInvestRuntimeConfigForTests();
    expect(getInvestRuntimeClientServiceName()).toBe('');
  });
});
