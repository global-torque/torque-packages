export type InvestAppApiUrls = {
  kratos?: string;
  plaid?: string;
  investment?: string;
  offer?: string;
  esign?: string;
  user?: string;
  notification?: string;
  accreditation?: string;
  payments?: string;
  wallet?: string;
  evm?: string;
  filer?: string;
  distributions?: string;
  analytic?: string;
  docuseal?: string;
  fundManager?: string;
};

export type InvestAppUrls = {
  frontend?: string;
  dashboard?: string;
  static?: string;
  cryptoWalletScan?: string;
  api: InvestAppApiUrls;
};

export type InvestAppBrandConfig = {
  profile?: string;
  title: string;
  description: string;
  author?: string;
  email?: string;
  logo?: string;
  logoReversed?: string;
  mark?: string;
  favicon?: string;
  socialImage?: string;
  pwaIcon?: string;
  pwaName?: string;
  pwaShortName?: string;
  stylesheet?: string;
  themeColor?: string;
  seoTitle?: string;
  seoDescription?: string;
};

export type RequiredInvestRuntimeBrand = Required<Pick<
  InvestAppBrandConfig,
  | 'profile'
  | 'title'
  | 'description'
  | 'email'
  | 'logo'
  | 'logoReversed'
  | 'mark'
  | 'pwaName'
>>;

export type InvestStaticContactConfig = {
  address1: string;
  address2: string;
  phone: string;
  email: string;
};

export type InvestStaticSocialConfig = {
  icon: string;
  iconName: string;
  name: string;
  href?: string;
  shareHref?: string;
};

export type InvestRuntimeBrandConfig = {
  brand: RequiredInvestRuntimeBrand;
  contact: InvestStaticContactConfig;
  socials: Readonly<Record<string, InvestStaticSocialConfig>>;
};

export type InvestAppDemoAccountConfig = {
  email?: string;
  password?: string;
};

export type InvestAppBuildConfig = {
  version?: string;
  timestamp?: string;
};

export type InvestAppConfig = {
  env?: string;
  isDev?: boolean;
  isStaticSite?: boolean;
  enableAnalytics?: boolean;
  cookieDomain?: string;
  stableCoinAddress?: string;
  pwaTestHostname?: string;
  urls: InvestAppUrls;
  brand: InvestAppBrandConfig;
  demoAccount?: InvestAppDemoAccountConfig;
  build?: InvestAppBuildConfig;
  thirdParty: Record<string, string | undefined>;
};

export type InvestAppBaseConfig = Omit<InvestAppConfig, 'brand'>;

export type InvestAppLinkConfig = Pick<InvestAppUrls, 'dashboard' | 'static'>;

export type InvestAppConfigEnvironment = Partial<Record<string, string | boolean | undefined>>;

const REQUIRED_RUNTIME_BRAND_KEYS = [
  'profile', 'title', 'description', 'email', 'logo', 'logoReversed', 'mark', 'pwaName',
] as const;

const assertNonBlank = (value: unknown, path: string): void => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Static build configuration requires nonblank ${path}.`);
  }
};

const assertObject = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Static build configuration requires object ${path}.`);
  }
  return value as Record<string, unknown>;
};

const assertOptionalNonBlank = (value: unknown, path: string): void => {
  if (value !== undefined) assertNonBlank(value, path);
};

export function assertInvestRuntimeBrandConfig(
  config: unknown,
  path = 'runtime',
): asserts config is InvestRuntimeBrandConfig {
  const runtime = assertObject(config, path);
  const brand = assertObject(runtime.brand, `${path}.brand`);
  for (const key of REQUIRED_RUNTIME_BRAND_KEYS) {
    assertNonBlank(brand[key], `${path}.brand.${key}`);
  }

  const contact = assertObject(runtime.contact, `${path}.contact`);
  for (const key of ['address1', 'address2', 'phone', 'email'] as const) {
    assertNonBlank(contact[key], `${path}.contact.${key}`);
  }

  const socials = assertObject(runtime.socials, `${path}.socials`);
  if (Object.keys(socials).length === 0) {
    throw new Error(`Static build configuration requires at least one ${path}.socials entry.`);
  }
  for (const [key, rawSocial] of Object.entries(socials)) {
    const social = assertObject(rawSocial, `${path}.socials.${key}`);
    for (const field of ['icon', 'iconName', 'name'] as const) {
      assertNonBlank(social[field], `${path}.socials.${key}.${field}`);
    }
    assertOptionalNonBlank(social.href, `${path}.socials.${key}.href`);
    assertOptionalNonBlank(social.shareHref, `${path}.socials.${key}.shareHref`);
    if (social.href === undefined && social.shareHref === undefined) {
      throw new Error(
        `Static build configuration requires ${path}.socials.${key}.href or ${path}.socials.${key}.shareHref.`,
      );
    }
  }
}

export function serializeStaticConfigForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}

const TURNKEY_SERVER_SIGN_PATH = 'auth/turnkey/server-sign';
const EVM_CONTRACT_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

const joinUrlPath = (baseUrl: string, path: string): string => {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const trimmedPath = path.trim().replace(/^\/+/, '');
  return trimmedBaseUrl && trimmedPath ? `${trimmedBaseUrl}/${trimmedPath}` : '';
};

const normalizeStableCoinAddress = (value: unknown): string => {
  const address = String(value ?? '').trim();
  if (!address) return '';
  if (!EVM_CONTRACT_ADDRESS_PATTERN.test(address)) {
    throw new Error('STABLE_COIN must be a 20-byte 0x-prefixed EVM contract address.');
  }
  return address.toLowerCase();
};

/**
 * Converts a host-owned environment record into the immutable application
 * configuration consumed by invest-runtime. Reading build-tool environment
 * globals remains the responsibility of each app.
 */
export function createInvestAppConfigFromEnv(
  env: InvestAppConfigEnvironment,
): InvestAppBaseConfig;
export function createInvestAppConfigFromEnv(
  env: InvestAppConfigEnvironment,
  staticConfig: InvestRuntimeBrandConfig,
): InvestAppConfig;
export function createInvestAppConfigFromEnv(
  env: InvestAppConfigEnvironment,
  staticConfig?: InvestRuntimeBrandConfig,
): InvestAppBaseConfig | InvestAppConfig {
  const evmApiUrl = String(env.EVM_URL ?? '');
  const turnkeyServerSignUrl = String(
    env.TURNKEY_SERVER_SIGN_URL ?? joinUrlPath(evmApiUrl, TURNKEY_SERVER_SIGN_PATH),
  );

  const baseConfig: InvestAppBaseConfig = {
    env: String(env.ENV ?? env.MODE ?? ''),
    isDev: env.DEV === true || env.DEV === 'true',
    isStaticSite: env.IS_STATIC_SITE === true || env.IS_STATIC_SITE === 'true' || env.IS_STATIC_SITE === '1',
    enableAnalytics: env.ENABLE_ANALYTICS === true || env.ENABLE_ANALYTICS === 'true' || env.ENABLE_ANALYTICS === '1',
    cookieDomain: String(env.COOKIE_DOMAIN ?? ''),
    stableCoinAddress: normalizeStableCoinAddress(env.STABLE_COIN),
    urls: {
      frontend: String(env.FRONTEND_URL ?? ''),
      dashboard: String(env.FRONTEND_URL_DASHBOARD ?? ''),
      static: String(env.FRONTEND_URL_STATIC ?? ''),
      cryptoWalletScan: String(env.CRYPTO_WALLET_SCAN_URL ?? ''),
      api: {
        kratos: String(env.KRATOS_URL ?? ''),
        plaid: String(env.PLAID_URL ?? ''),
        investment: String(env.INVESTMENT_URL ?? ''),
        offer: String(env.OFFER_URL ?? ''),
        esign: String(env.ESIGN_URL ?? ''),
        user: String(env.USER_URL ?? ''),
        notification: String(env.NOTIFICATION_URL ?? ''),
        accreditation: String(env.ACCREDITATION_URL ?? ''),
        payments: String(env.PAYMENTS_URL ?? ''),
        wallet: String(env.WALLET_URL ?? ''),
        evm: evmApiUrl,
        filer: String(env.FILER_URL ?? ''),
        distributions: String(env.DISTRIBUTIONS_URL ?? ''),
        analytic: String(env.ANALYTIC_URL ?? ''),
        docuseal: String(env.DOCUSEAL_URL ?? ''),
        fundManager: String(env.FUND_MANAGER_URL ?? ''),
      },
    },
    demoAccount: {
      email: String(env.DEMO_ACCOUNT_EMAIL ?? ''),
      password: String(env.DEMO_ACCOUNT_PASSWORD ?? ''),
    },
    build: {
      version: String(env.APP_VERSION ?? ''),
      timestamp: String(env.APP_BUILD_TIMESTAMP ?? ''),
    },
    thirdParty: {
      hellosignClientId: String(env.HELLOSIGN_CLIENT_ID ?? ''),
      segmentKey: String(env.SEGMENT_KEY ?? ''),
      alchemyWalletApiKey: String(env.ALCHEMY_WALLET_API_KEY ?? ''),
      alchemy7702PolicyId: String(env.ALCHEMY_7702_POLICY_ID ?? ''),
      turnkeyApiBaseUrl: String(env.TURNKEY_API_BASE_URL ?? 'https://api.turnkey.com'),
      turnkeyOrganizationId: String(env.TURNKEY_ORGANIZATION_ID ?? ''),
      turnkeyServerSignUrl,
      turnkeySessionExpirationSeconds: String(env.TURNKEY_SESSION_EXPIRATION_SECONDS ?? '3600'),
      turnkeyRegistrationEnabled: String(env.TURNKEY_REGISTRATION_ENABLED ?? 'false'),
    },
  };
  if (!staticConfig) return baseConfig;
  return { ...baseConfig, brand: { ...staticConfig.brand } };
}

const trimTrailingSlash = (value?: string) => String(value ?? '').replace(/\/$/, '');

export const createInvestAppLinks = (config: InvestAppLinkConfig) => {
  const staticUrl = trimTrailingSlash(config.static);
  const dashboardUrl = trimTrailingSlash(config.dashboard);

  const profileTab = (profileId: number, tab: string) => (
    `${dashboardUrl}/profile/${profileId}/account?tab=${tab}`
  );

  return {
    home: `${staticUrl}/`,
    signin: `${staticUrl}/signin`,
    authenticator: `${staticUrl}/authenticator`,
    signup: `${staticUrl}/signup`,
    forgot: `${staticUrl}/forgot`,
    resetPassword: `${dashboardUrl}/reset-password`,
    checkEmail: `${staticUrl}/check-email`,
    contactUs: `${staticUrl}/contact-us`,
    offers: `${staticUrl}/offers`,
    howItWorks: `${staticUrl}/how-it-works`,
    faq: `${staticUrl}/faq`,
    blog: `${staticUrl}/resource-center`,
    terms: `${staticUrl}/legal/terms-of-use`,
    privacy: `${staticUrl}/legal/privacy-policy`,
    cookie: `${staticUrl}/legal/cookie`,
    serverError: `${dashboardUrl}/500`,
    notifications: `${dashboardUrl}/notifications`,
    settings: (profileId: number) => `${dashboardUrl}/settings/${profileId}/mfa`,
    settingsAccountDetails: (profileId: number) => `${dashboardUrl}/settings/${profileId}/account-details`,
    settingsMfa: (profileId: number) => `${dashboardUrl}/settings/${profileId}/mfa`,
    settingsSecurity: (profileId: number) => `${dashboardUrl}/settings/${profileId}/security`,
    settingsBankAccounts: (profileId: number) => `${dashboardUrl}/settings/${profileId}/bank-accounts`,
    profileAccreditation: (profileId: number) => `${dashboardUrl}/profile/${profileId}/accreditation`,
    investmentTimeline: (profileId: number, investId: string) => (
      `${dashboardUrl}/profile/${profileId}/investment/${investId}/timeline`
    ),
    profileCryptoWallet: (profileId: number) => `${dashboardUrl}/profile/${profileId}/evmwallet`,
    profileWallet: (profileId: number) => `${dashboardUrl}/profile/${profileId}/wallet`,
    profileAccount: (profileId: number) => `${dashboardUrl}/profile/${profileId}/account`,
    profileEarn: (profileId: number) => `${dashboardUrl}/profile/${profileId}/earn`,
    earnOverview: (profileId: number, poolId: string | number) => (
      `${dashboardUrl}/profile/${profileId}/earn/${poolId}/overview`
    ),
    earnYourPosition: (profileId: number, poolId: string | number) => (
      `${dashboardUrl}/profile/${profileId}/earn/${poolId}/your-position`
    ),
    earnRisk: (profileId: number, poolId: string | number) => (
      `${dashboardUrl}/profile/${profileId}/earn/${poolId}/risk`
    ),
    profileKyc: (profileId: number) => `${dashboardUrl}/profile/${profileId}/kyc`,
    profileWalletOtp: (profileId: number) => `${dashboardUrl}/profile/${profileId}/wallet-otp`,
    profilePortfolio: (profileId: number) => `${dashboardUrl}/profile/${profileId}/portfolio`,
    profileSummary: (profileId: number) => `${dashboardUrl}/profile/${profileId}/summary`,
    profile: () => `${dashboardUrl}/profile`,
    createProfile: () => `${dashboardUrl}/profile/create-new-profile`,
    offerSingle: (slug: string) => `${staticUrl}/${slug}`,
    blogSingle: (slug: string) => `${staticUrl}/resource-center/${slug}`,
    profileTabSummary: (profileId: number) => profileTab(profileId, 'summary'),
    profileTabPortfolio: (profileId: number) => profileTab(profileId, 'portfolio'),
    profileTabWallet: (profileId: number) => profileTab(profileId, 'wallet'),
    profileTabDistributions: (profileId: number) => profileTab(profileId, 'distributions'),
    profileTabEarn: (profileId: number) => profileTab(profileId, 'earn'),
  };
};
