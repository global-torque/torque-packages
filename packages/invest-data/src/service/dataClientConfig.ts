import {
  createInvestAppLinks,
  type InvestAppApiUrls,
  type InvestAppConfig,
  type InvestAppUrls,
} from '@global-torque/invest-core/app/config';
import { ApiClient } from './apiClient.ts';
import type { ApiClientHooks } from './apiClientHooks.ts';
import { resolveAllowedRedirectOrigins } from '../migration/redirectOrigins.ts';

export type InvestDataApiKey = keyof InvestAppApiUrls;
export type InvestDataThirdPartyKey =
  | 'alchemyWalletApiKey'
  | 'alchemy7702PolicyId'
  | 'turnkeyApiBaseUrl'
  | 'turnkeyOrganizationId'
  | 'turnkeyServerSignUrl'
  | 'turnkeySessionExpirationSeconds'
  | 'turnkeyRegistrationEnabled';
export type InvestDataAppUrls = Pick<InvestAppUrls, 'frontend' | 'dashboard' | 'static'>;

export type InvestDataClientConfig = {
  apiUrls?: Partial<Record<InvestDataApiKey, string | undefined>>;
  appUrls?: Partial<InvestDataAppUrls>;
  allowedRedirectOrigins?: readonly string[];
  cryptoWalletScanUrl?: string;
  stableCoinAddress?: string;
  isDev?: boolean;
  thirdParty?: Partial<Record<InvestDataThirdPartyKey, string | undefined>>;
};

const cloneInvestDataClientConfig = (config: InvestDataClientConfig = {}): InvestDataClientConfig => ({
  ...config,
  apiUrls: { ...(config.apiUrls ?? {}) },
  appUrls: { ...(config.appUrls ?? {}) },
  allowedRedirectOrigins: [...(config.allowedRedirectOrigins ?? [])],
  thirdParty: { ...(config.thirdParty ?? {}) },
});

let investDataClientConfig = cloneInvestDataClientConfig();

export const createInvestDataClientConfigFromAppConfig = (
  config: InvestAppConfig,
): InvestDataClientConfig => ({
  apiUrls: {
    ...config.urls.api,
  },
  appUrls: {
    frontend: config.urls.frontend,
    dashboard: config.urls.dashboard,
    static: config.urls.static,
  },
  allowedRedirectOrigins: resolveAllowedRedirectOrigins([
    config.urls.frontend,
    config.urls.dashboard,
    config.urls.static,
  ]),
  cryptoWalletScanUrl: config.urls.cryptoWalletScan,
  stableCoinAddress: config.stableCoinAddress,
  isDev: config.isDev,
  thirdParty: {
    alchemyWalletApiKey: config.thirdParty.alchemyWalletApiKey,
    alchemy7702PolicyId: config.thirdParty.alchemy7702PolicyId,
    turnkeyApiBaseUrl: config.thirdParty.turnkeyApiBaseUrl,
    turnkeyOrganizationId: config.thirdParty.turnkeyOrganizationId,
    turnkeyServerSignUrl: config.thirdParty.turnkeyServerSignUrl,
    turnkeySessionExpirationSeconds: config.thirdParty.turnkeySessionExpirationSeconds,
    turnkeyRegistrationEnabled: config.thirdParty.turnkeyRegistrationEnabled,
  },
});

export function setInvestDataClientConfig(config: InvestDataClientConfig = {}): void {
  investDataClientConfig = cloneInvestDataClientConfig(config);
}

export function configureInvestDataClientConfig(config: InvestDataClientConfig): void {
  investDataClientConfig = cloneInvestDataClientConfig({
    ...investDataClientConfig,
    ...config,
    apiUrls: {
      ...(investDataClientConfig.apiUrls ?? {}),
      ...(config.apiUrls ?? {}),
    },
    appUrls: {
      ...(investDataClientConfig.appUrls ?? {}),
      ...(config.appUrls ?? {}),
    },
    allowedRedirectOrigins: config.allowedRedirectOrigins
      ? [...config.allowedRedirectOrigins]
      : [...(investDataClientConfig.allowedRedirectOrigins ?? [])],
    thirdParty: {
      ...(investDataClientConfig.thirdParty ?? {}),
      ...(config.thirdParty ?? {}),
    },
  });
}

export function resetInvestDataClientConfig(config: InvestDataClientConfig = {}): void {
  setInvestDataClientConfig(config);
}

export function getInvestDataClientConfig(): InvestDataClientConfig {
  return cloneInvestDataClientConfig(investDataClientConfig);
}

export function getInvestDataApiUrl(
  key: InvestDataApiKey,
  config: InvestDataClientConfig = investDataClientConfig,
): string | undefined {
  return config.apiUrls?.[key] || undefined;
}

export function getInvestDataAllowedRedirectOrigins(
  config: InvestDataClientConfig = investDataClientConfig,
): readonly string[] {
  return [...(config.allowedRedirectOrigins ?? [])];
}

export function createInvestDataApiClient(
  key: InvestDataApiKey,
  config: InvestDataClientConfig = investDataClientConfig,
  options: {
    hooks?: ApiClientHooks | (() => ApiClientHooks);
    fetch?: typeof fetch;
    allowInsecureOrigins?: readonly string[];
    deduplicateSafeReads?: boolean;
    deduplicationScope?: () => string | null | undefined;
  } = {},
): ApiClient {
  return new ApiClient(getInvestDataApiUrl(key, config), {
    allowedRedirectOrigins: config.allowedRedirectOrigins,
    hooks: options.hooks,
    fetch: options.fetch,
    allowInsecureOrigins: options.allowInsecureOrigins,
    deduplicateSafeReads: options.deduplicateSafeReads,
    deduplicationScope: options.deduplicationScope,
  });
}

export function getInvestDataCryptoWalletScanUrl(
  config: InvestDataClientConfig = investDataClientConfig,
): string | undefined {
  return config.cryptoWalletScanUrl || undefined;
}

export function getInvestDataStableCoinAddress(
  config: InvestDataClientConfig = investDataClientConfig,
): string | undefined {
  return config.stableCoinAddress || undefined;
}

export function getInvestDataAppLinks(
  config: InvestDataClientConfig = investDataClientConfig,
): ReturnType<typeof createInvestAppLinks> {
  return createInvestAppLinks({
    dashboard: config.appUrls?.dashboard,
    static: config.appUrls?.static,
  });
}

export function getInvestDataThirdPartyValue(
  key: InvestDataThirdPartyKey,
  config: InvestDataClientConfig = investDataClientConfig,
): string | undefined {
  return config.thirdParty?.[key] || undefined;
}

export function isInvestDataDebugEnabled(
  config: InvestDataClientConfig = investDataClientConfig,
): boolean {
  return config.isDev === true;
}
