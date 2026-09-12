import {
  createInvestAppLinks,
  type InvestAppConfig,
  type InvestAppLinkConfig,
} from '@webdevelop-pro/invest-core/app/config';
import type { PwaPolicyEnv } from './pwa/pwaPolicy.ts';

export type InvestRuntimeLinks = ReturnType<typeof createInvestAppLinks>;

let runtimeConfig: InvestAppConfig | undefined;
let runtimeClientServiceName = '';

export function setInvestRuntimeConfig(config: InvestAppConfig): void {
  runtimeConfig = config;
}

export function getInvestRuntimeConfig(): InvestAppConfig {
  if (!runtimeConfig) throw new Error('Invest runtime config has not been installed.');
  return runtimeConfig;
}

export function resetInvestRuntimeConfigForTests(): void {
  runtimeConfig = undefined;
  runtimeClientServiceName = '';
}

export function setInvestRuntimeClientServiceName(serviceName?: string): void {
  runtimeClientServiceName = serviceName?.trim() ?? '';
}

export function getInvestRuntimeClientServiceName(): string {
  return runtimeClientServiceName;
}

export const createPwaPolicyEnvFromInvestAppConfig = (config: InvestAppConfig): PwaPolicyEnv => ({
  FRONTEND_URL: config.urls.frontend,
  OFFER_URL: config.urls.api.offer,
  USER_URL: config.urls.api.user,
  INVESTMENT_URL: config.urls.api.investment,
  WALLET_URL: config.urls.api.wallet,
  EVM_URL: config.urls.api.evm,
  FILER_URL: config.urls.api.filer,
  DISTRIBUTIONS_URL: config.urls.api.distributions,
  ACCREDITATION_URL: config.urls.api.accreditation,
  KRATOS_URL: config.urls.api.kratos,
});

export const getInvestRuntimePwaPolicyEnv = () => (
  createPwaPolicyEnvFromInvestAppConfig(getInvestRuntimeConfig())
);

export const createInvestRuntimeLinks = (config: InvestAppLinkConfig) => (
  createInvestAppLinks(config)
);

export const getInvestRuntimeLinks = () => (
  createInvestRuntimeLinks({
    dashboard: getInvestRuntimeConfig().urls.dashboard,
    static: getInvestRuntimeConfig().urls.static,
  })
);

export const isInvestRuntimeFlagEnabled = (key: 'ENABLE_ANALYTICS' | 'IS_STATIC_SITE' | 'DEV') => {
  const config = getInvestRuntimeConfig();
  switch (key) {
    case 'ENABLE_ANALYTICS':
      return Boolean(config.enableAnalytics);
    case 'IS_STATIC_SITE':
      return Boolean(config.isStaticSite);
    case 'DEV':
      return Boolean(config.isDev);
    default:
      return false;
  }
};
