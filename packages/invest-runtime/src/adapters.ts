import type { Ref } from 'vue';
import type { ActionState } from '@webdevelop-pro/invest-data/repository';
import type { IDistributionFormatted } from '@webdevelop-pro/domain-types/distributionsTypes';
import type { INotification } from '@webdevelop-pro/domain-types/notificationsTypes';
import type { IOfferData, IOfferFormatted } from '@webdevelop-pro/domain-types/offerTypes';
import type { IInvestmentFormatted, IInvestUnconfirmed } from '@webdevelop-pro/domain-types/investmentTypes';
import type { IAnalyticsEventRequest } from '@webdevelop-pro/domain-types/analyticsTypes';
import type { ISession } from '@webdevelop-pro/domain-types/authTypes';
import type {
  IProfileData,
  IProfileFormatted,
  IUserFormatted,
} from '@webdevelop-pro/domain-types/profilesTypes';

export type RuntimeInvestmentLike = {
  id?: string | number;
};

export type RuntimeNotificationLike = unknown;

export interface RuntimeAuthAdapter {
  getSession: () => Promise<ISession | null | undefined>;
  getCachePartition?: () => string | null | undefined;
  resetAll?: () => void;
}

export interface RuntimeProfilesAdapter {
  init: (options?: { force?: boolean }) => Promise<void> | void;
  getUserProfiles: () => Array<{ id: number }>;
  getSelectedUserProfileId: () => number | string | undefined;
  setSelectedUserProfileById: (id: number) => void;
  resetSelectedProfile: () => void;
  resetAccountData?: () => void;
  resetProfileData: () => void;
  loadUserProfiles: () => Promise<void> | void;
}

export interface RuntimeProfileRepositoryStore {
  setProfileState: ActionState<IProfileData | undefined>;
  getProfileOptionsState: ActionState<unknown>;
  getUserState: ActionState<IUserFormatted | undefined>;
  getProfileByIdState: ActionState<IProfileFormatted | undefined>;
  setProfileByIdState: ActionState<unknown>;
  getProfileByIdOptionsState: ActionState<unknown>;
  setUserState: ActionState<IProfileData | undefined>;
  setUserOptionsState: ActionState<unknown>;
  updateUserDataState: ActionState<unknown>;
  resetAll: () => void;
  resetProfileData: () => void;
  getUser: (options?: {
    authoritative?: boolean;
    preserveDataOnError?: boolean;
  }) => Promise<unknown>;
  setUser: (data: IProfileData) => Promise<unknown>;
  setUserOptions: () => Promise<unknown>;
  updateUserData: (body: Record<string, unknown>) => Promise<unknown>;
  setOptimisticUserImageId: (fileId: number) => void;
  getProfileById: (type: string, id: string | number) => Promise<unknown>;
  getProfileByIdOptions: (type: string, id: string | number) => Promise<unknown>;
  setProfileById: (
    data: IProfileData,
    type: string,
    id: string | number,
  ) => Promise<unknown>;
  setProfile: (data: IProfileData, type: string) => Promise<unknown>;
  getProfileOptions: (type: string) => Promise<unknown>;
}

export interface RuntimeFundingSource {
  id: string | number;
  bank_name?: string;
  name?: string;
  last4?: string;
}

export interface RuntimeWalletSettingsData {
  funding_source?: RuntimeFundingSource[];
  isWalletStatusAnyError?: boolean;
  isWalletStatusCreated?: boolean;
}

export interface RuntimeWalletSettingsModel {
  getWalletState: Ref<ActionState<RuntimeWalletSettingsData | undefined>>;
  deleteLinkedAccountState: Ref<ActionState<unknown>>;
  walletId: Ref<number>;
  createLinkExchangeState: Ref<ActionState<{
    access_token?: string;
    accounts?: Array<{ account_id?: string; name?: string; mask?: string }>;
  } | undefined>>;
  createLinkTokenState: Ref<ActionState<{ link_token?: string } | undefined>>;
  createLinkToken: (profileId: number) => Promise<unknown>;
  createLinkExchange: (profileId: number, body: unknown) => Promise<unknown>;
  createLinkProcess: (profileId: number, body: unknown) => Promise<unknown>;
  deleteLinkedAccount: (profileId: number, body: unknown) => Promise<unknown>;
  updateData: () => Promise<void>;
}

export interface RuntimeWalletSettingsAdapter {
  getModel: () => RuntimeWalletSettingsModel;
}

export interface RuntimeProfileRepositoryAdapter {
  getStore: () => RuntimeProfileRepositoryStore;
}

export interface RuntimeRepositoriesAdapter {
  resetProfileRepositories: () => void;
  resetFullRepositories: () => void | Promise<void>;
}

export interface RuntimeAnalyticsAdapter {
  trackEvent: (event: IAnalyticsEventRequest) => Promise<void>;
  logMessage: (message: Record<string, unknown>) => Promise<void>;
}

export interface RuntimeNotificationsAdapter {
  updateNotificationsData: (data: string) => void;
  refreshNotifications: () => Promise<void>;
  formatNotificationHref: (notification: RuntimeNotificationLike) => string;
  fallbackHref: () => string;
}

export interface RuntimeRealtimeAdapter {
  handleInternalNotification: (notification: INotification) => void;
}

export interface RuntimeAccreditationModel {
  createEscrowState: ActionState<unknown>;
  createEscrow: (userId: number, profileId: number) => Promise<unknown>;
  resetAll: () => void;
}

export interface RuntimeAccreditationAdapter {
  getModel: () => RuntimeAccreditationModel;
}

export interface RuntimeKycModel {
  tokenState: ActionState<unknown>;
  isPlaidLoading: boolean;
  handlePlaidKyc: (profileId: number | string) => Promise<unknown>;
  handlePlaidKycToken: (linkToken: string) => Promise<unknown>;
  resetAll: () => void;
}

export interface RuntimeKycAdapter {
  getModel: () => RuntimeKycModel;
}

export interface RuntimeDashboardOfflineAdapter {
  hasTabData: (tab: string, hasSelectedProfileData: boolean) => boolean;
  ensureTabData: (options: {
    tab: string;
    profileId: number;
    profileType?: string | null;
  }) => Promise<void>;
}

export interface RuntimeInvestmentAdapter {
  ensureInvestmentsLoaded: (profileId: string) => Promise<void>;
  hasInvestment: (investmentId: string) => boolean;
  getCurrentInvestmentId: () => string | number | undefined;
  isCurrentInvestmentComplete?: (investmentId: string) => boolean;
  clearCurrentInvestment?: () => void;
  loadInvestment: (investmentId: string) => Promise<void>;
  getInvestUnconfirmed: (
    slug: string,
    profileId: number | string,
    investmentId?: number | string,
  ) => Promise<IInvestUnconfirmed | null>;
  setInvest: (slug: string, profileId: string) => Promise<IInvestmentFormatted>;
}

export interface RuntimeRoutePreloadAdapter {
  preloadInvestAmountOptions: (slug: string, id: string, profileId: string) => void;
  ensureUserOptionsLoaded: () => void;
}

export interface RuntimeSeoAdapter {
  setMetaData: (metadata: {
    seo_title: string;
    seo_description: string;
    canonical: string;
  }) => void;
}

export interface RuntimeDialogsAdapter {
  showRefreshSession: () => Promise<boolean>;
}

export interface RuntimeOfferModel {
  getOffersState: ActionState<IOfferData | undefined>;
  getOfferOneState: ActionState<IOfferFormatted | undefined>;
  getOffers: () => Promise<IOfferData>;
  getOfferOne: (slug: string) => Promise<IOfferFormatted>;
  getTopOpenOffer: () => IOfferFormatted | undefined;
  updateNotificationData: (notification: INotification) => void;
  resetAll: () => void;
}

export interface RuntimeOfferAdapter {
  getModel: () => RuntimeOfferModel;
}

export interface RuntimeDistributionsModel {
  getDistributionsState: ActionState<IDistributionFormatted[]>;
  getDistributions: (profileId?: string) => Promise<IDistributionFormatted[]>;
  resetAll: () => void;
}

export interface RuntimeDistributionsAdapter {
  getModel: () => RuntimeDistributionsModel;
}

export interface RuntimeEarnAdapter {
  getPositionPools: () => unknown[];
  getPositions: (poolId: string, profileId: string | number) => Promise<unknown>;
  resetAll: () => void;
}

export interface InvestRuntimeAdapters {
  auth?: RuntimeAuthAdapter;
  profiles?: RuntimeProfilesAdapter;
  profileRepository?: RuntimeProfileRepositoryAdapter;
  walletSettings?: RuntimeWalletSettingsAdapter;
  repositories?: RuntimeRepositoriesAdapter;
  analytics?: RuntimeAnalyticsAdapter;
  notifications?: RuntimeNotificationsAdapter;
  realtime?: RuntimeRealtimeAdapter;
  accreditation?: RuntimeAccreditationAdapter;
  kyc?: RuntimeKycAdapter;
  dashboardOffline?: RuntimeDashboardOfflineAdapter;
  investment?: RuntimeInvestmentAdapter;
  routePreload?: RuntimeRoutePreloadAdapter;
  seo?: RuntimeSeoAdapter;
  dialogs?: RuntimeDialogsAdapter;
  offer?: RuntimeOfferAdapter;
  distributions?: RuntimeDistributionsAdapter;
  earn?: RuntimeEarnAdapter;
}

let adapters: InvestRuntimeAdapters = {};

export function configureInvestRuntimeAdapters(nextAdapters: InvestRuntimeAdapters): void {
  adapters = {
    ...adapters,
    ...nextAdapters,
  };
}

export function resetInvestRuntimeAdaptersForTests(): void {
  adapters = {};
}

export function getInvestRuntimeAdapters(): InvestRuntimeAdapters {
  return adapters;
}

export function resolveInvestRuntimePrivateCachePartition(
  runtimeAdapters: InvestRuntimeAdapters,
): string | null {
  const sessionPartition = runtimeAdapters.auth?.getCachePartition?.()?.trim();
  if (!sessionPartition) return null;
  const profileId = runtimeAdapters.profiles?.getSelectedUserProfileId();
  const profilePartition = profileId === undefined || profileId === null || String(profileId).trim() === ''
    ? 'none'
    : String(profileId).trim();
  return `${sessionPartition}:profile:${profilePartition}`;
}

export function getRequiredInvestRuntimeAdapter<K extends keyof InvestRuntimeAdapters>(
  key: K,
): NonNullable<InvestRuntimeAdapters[K]> {
  const adapter = adapters[key];

  if (!adapter) {
    throw new Error(`Invest runtime adapter "${String(key)}" has not been configured.`);
  }

  return adapter as NonNullable<InvestRuntimeAdapters[K]>;
}

export const toRefValue = <T>(value: T | Ref<T>) => (
  typeof value === 'object' && value !== null && 'value' in value
    ? (value as Ref<T>).value
    : value
);
