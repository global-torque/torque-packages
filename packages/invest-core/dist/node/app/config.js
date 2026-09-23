const REQUIRED_RUNTIME_BRAND_KEYS = [
    'profile', 'title', 'description', 'email', 'logo', 'logoReversed', 'mark', 'pwaName',
];
const assertNonBlank = (value, path) => {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Static build configuration requires nonblank ${path}.`);
    }
};
const assertObject = (value, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Static build configuration requires object ${path}.`);
    }
    return value;
};
const assertOptionalNonBlank = (value, path) => {
    if (value !== undefined)
        assertNonBlank(value, path);
};
export function assertInvestRuntimeBrandConfig(config, path = 'runtime') {
    const runtime = assertObject(config, path);
    const brand = assertObject(runtime.brand, `${path}.brand`);
    for (const key of REQUIRED_RUNTIME_BRAND_KEYS) {
        assertNonBlank(brand[key], `${path}.brand.${key}`);
    }
    const contact = assertObject(runtime.contact, `${path}.contact`);
    for (const key of ['address1', 'address2', 'phone', 'email']) {
        assertNonBlank(contact[key], `${path}.contact.${key}`);
    }
    const socials = assertObject(runtime.socials, `${path}.socials`);
    if (Object.keys(socials).length === 0) {
        throw new Error(`Static build configuration requires at least one ${path}.socials entry.`);
    }
    for (const [key, rawSocial] of Object.entries(socials)) {
        const social = assertObject(rawSocial, `${path}.socials.${key}`);
        for (const field of ['icon', 'iconName', 'name']) {
            assertNonBlank(social[field], `${path}.socials.${key}.${field}`);
        }
        assertOptionalNonBlank(social.href, `${path}.socials.${key}.href`);
        assertOptionalNonBlank(social.shareHref, `${path}.socials.${key}.shareHref`);
        if (social.href === undefined && social.shareHref === undefined) {
            throw new Error(`Static build configuration requires ${path}.socials.${key}.href or ${path}.socials.${key}.shareHref.`);
        }
    }
}
export function serializeStaticConfigForInlineScript(value) {
    return JSON.stringify(value).replace(/</gu, '\\u003c');
}
const TURNKEY_SERVER_SIGN_PATH = 'auth/turnkey/server-sign';
const EVM_CONTRACT_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const joinUrlPath = (baseUrl, path) => {
    const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    const trimmedPath = path.trim().replace(/^\/+/, '');
    return trimmedBaseUrl && trimmedPath ? `${trimmedBaseUrl}/${trimmedPath}` : '';
};
const normalizeStableCoinAddress = (value) => {
    const address = String(value ?? '').trim();
    if (!address)
        return '';
    if (!EVM_CONTRACT_ADDRESS_PATTERN.test(address)) {
        throw new Error('STABLE_COIN must be a 20-byte 0x-prefixed EVM contract address.');
    }
    return address.toLowerCase();
};
export function createInvestAppConfigFromEnv(env, staticConfig) {
    const evmApiUrl = String(env.EVM_URL ?? '');
    const turnkeyServerSignUrl = String(env.TURNKEY_SERVER_SIGN_URL ?? joinUrlPath(evmApiUrl, TURNKEY_SERVER_SIGN_PATH));
    const baseConfig = {
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
    if (!staticConfig)
        return baseConfig;
    return { ...baseConfig, brand: { ...staticConfig.brand } };
}
const trimTrailingSlash = (value) => String(value ?? '').replace(/\/$/, '');
export const createInvestAppLinks = (config) => {
    const staticUrl = trimTrailingSlash(config.static);
    const dashboardUrl = trimTrailingSlash(config.dashboard);
    const profileTab = (profileId, tab) => (`${dashboardUrl}/profile/${profileId}/account?tab=${tab}`);
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
        settings: (profileId) => `${dashboardUrl}/settings/${profileId}/mfa`,
        settingsAccountDetails: (profileId) => `${dashboardUrl}/settings/${profileId}/account-details`,
        settingsMfa: (profileId) => `${dashboardUrl}/settings/${profileId}/mfa`,
        settingsSecurity: (profileId) => `${dashboardUrl}/settings/${profileId}/security`,
        settingsBankAccounts: (profileId) => `${dashboardUrl}/settings/${profileId}/bank-accounts`,
        profileAccreditation: (profileId) => `${dashboardUrl}/profile/${profileId}/accreditation`,
        investmentTimeline: (profileId, investId) => (`${dashboardUrl}/profile/${profileId}/investment/${investId}/timeline`),
        profileCryptoWallet: (profileId) => `${dashboardUrl}/profile/${profileId}/evmwallet`,
        profileWallet: (profileId) => `${dashboardUrl}/profile/${profileId}/wallet`,
        profileAccount: (profileId) => `${dashboardUrl}/profile/${profileId}/account`,
        profileEarn: (profileId) => `${dashboardUrl}/profile/${profileId}/earn`,
        earnOverview: (profileId, poolId) => (`${dashboardUrl}/profile/${profileId}/earn/${poolId}/overview`),
        earnYourPosition: (profileId, poolId) => (`${dashboardUrl}/profile/${profileId}/earn/${poolId}/your-position`),
        earnRisk: (profileId, poolId) => (`${dashboardUrl}/profile/${profileId}/earn/${poolId}/risk`),
        profileKyc: (profileId) => `${dashboardUrl}/profile/${profileId}/kyc`,
        profileWalletOtp: (profileId) => `${dashboardUrl}/profile/${profileId}/wallet-otp`,
        profilePortfolio: (profileId) => `${dashboardUrl}/profile/${profileId}/portfolio`,
        profileSummary: (profileId) => `${dashboardUrl}/profile/${profileId}/summary`,
        profile: () => `${dashboardUrl}/profile`,
        createProfile: () => `${dashboardUrl}/profile/create-new-profile`,
        offerSingle: (slug) => `${staticUrl}/${slug}`,
        blogSingle: (slug) => `${staticUrl}/resource-center/${slug}`,
        profileTabSummary: (profileId) => profileTab(profileId, 'summary'),
        profileTabPortfolio: (profileId) => profileTab(profileId, 'portfolio'),
        profileTabWallet: (profileId) => profileTab(profileId, 'wallet'),
        profileTabDistributions: (profileId) => profileTab(profileId, 'distributions'),
        profileTabEarn: (profileId) => profileTab(profileId, 'earn'),
    };
};
