import {
  computed,
  hasInjectionContext,
  inject,
  provide,
  ref,
  shallowRef,
  type App,
  type Component,
  type InjectionKey,
  type Ref,
} from 'vue';
import type { KycAlertModel } from '@global-torque/invest-core/kyc/status';
import type { WalletAuthOperationIntent } from '@global-torque/invest-core/wallet/auth';

export type WidgetAlertVariant = 'error' | 'info';
export type WidgetReadonlyRef<T> = Readonly<Ref<T>>;

export interface WidgetAlertModel {
  show?: boolean;
  variant: WidgetAlertVariant;
  title?: string;
  description?: string;
  buttonText?: string;
  isLoading: boolean;
  isDisabled: boolean;
}

export interface AccreditationButtonModel {
  text: string;
  class: string;
  button?: boolean;
  tooltip?: string;
  mobileText?: string;
}

export type AccreditationButtonBadgeColor =
  | 'secondary'
  | 'red'
  | 'yellow';

export interface AccreditationAlertViewModel {
  alertModel: WidgetReadonlyRef<WidgetAlertModel>;
  isDataLoading: WidgetReadonlyRef<boolean>;
  onPrimaryAction: () => void | Promise<void>;
  onDescriptionAction: (event: Event) => void;
}

export interface AccreditationButtonViewModel {
  data: WidgetReadonlyRef<AccreditationButtonModel | null>;
  tagBackground: WidgetReadonlyRef<AccreditationButtonBadgeColor>;
  onClick: () => void | Promise<void>;
}

export interface AccreditationWidgetProvider {
  useAlert: () => AccreditationAlertViewModel;
  useButton: () => AccreditationButtonViewModel;
}

export interface KycAlertViewModel {
  alertModel: WidgetReadonlyRef<KycAlertModel>;
  isDataLoading: WidgetReadonlyRef<boolean>;
  onPrimaryAction: () => void | Promise<void>;
  onDescriptionAction: (event: Event) => void;
}

export interface KycWidgetProvider {
  useAlert: () => KycAlertViewModel;
}

export interface NotificationsSidebarViewModel {
  BadgeComponent?: Component;
  SidebarComponent?: Component;
  loadData: () => void | Promise<void>;
  onSidebarToggle: (isOpen: boolean) => void;
  isSidebarOpen: WidgetReadonlyRef<boolean>;
}

export interface NotificationsWidgetProvider {
  useSidebar: () => NotificationsSidebarViewModel;
}

export interface FilerWidgetProvider {
  getCurrentUserId: () => number | undefined;
  getFilerUrl: () => string;
  uploadFile: (
    file: File,
    options: {
      objectId: number;
      objectName: string;
      userId: number;
      signal?: AbortSignal;
    },
  ) => Promise<{ fileId: number }>;
  reportError: (error: unknown, context: string) => void;
}

export interface ProfileSwitchMenuItem {
  id: string;
  label: string;
  statusLabel?: string;
  statusVariant?: 'success' | 'error';
  isActive: boolean;
  isCreateAction?: boolean;
}

export interface ProfileSwitchMenuViewModel {
  profileItems: WidgetReadonlyRef<ProfileSwitchMenuItem[]>;
  selectedProfileLabel: WidgetReadonlyRef<string>;
  onSelectProfile: (id: string) => void | Promise<void>;
}

export interface ProfilesWidgetProvider {
  useProfileSwitchMenu: () => ProfileSwitchMenuViewModel;
}

export interface WalletAuthDialogOptions {
  open: Ref<boolean | undefined>;
}

export interface WalletAuthDialogViewModel {
  codeValue: Ref<string>;
  isBusy: WidgetReadonlyRef<boolean>;
  isCodeStep: WidgetReadonlyRef<boolean>;
  isOtpStep: WidgetReadonlyRef<boolean>;
  isSuccessStep: WidgetReadonlyRef<boolean>;
  dialogTitle: WidgetReadonlyRef<string>;
  operationIntent: WidgetReadonlyRef<WalletAuthOperationIntent | null>;
  operationSummaryScanBaseUrl: WidgetReadonlyRef<string>;
  stepDescription: WidgetReadonlyRef<string>;
  inputLabel: WidgetReadonlyRef<string>;
  inputPlaceholder: WidgetReadonlyRef<string>;
  inputHelperText: WidgetReadonlyRef<string>;
  primaryButtonText: WidgetReadonlyRef<string>;
  isPrimaryDisabled: WidgetReadonlyRef<boolean>;
  closeDialog: () => void | Promise<void>;
  handlePrimaryClick: () => void | Promise<void>;
}

export interface WalletAuthWidgetProvider {
  useDialog: (options: WalletAuthDialogOptions) => WalletAuthDialogViewModel;
}

export interface InvestWidgetProviders {
  accreditation: AccreditationWidgetProvider;
  kyc: KycWidgetProvider;
  notifications: NotificationsWidgetProvider;
  filer: FilerWidgetProvider;
  profiles: ProfilesWidgetProvider;
  walletAuth: WalletAuthWidgetProvider;
}

const noop = () => undefined;
const noopAsync = async () => undefined;

const hiddenAlert = computed<WidgetAlertModel>(() => ({
  show: false,
  variant: 'error',
  title: '',
  description: '',
  buttonText: undefined,
  isLoading: false,
  isDisabled: false,
}));

const hiddenKycAlert = computed<KycAlertModel>(() => ({
  show: false,
  variant: 'error',
  title: '',
  description: '',
  buttonText: undefined,
  isLoading: false,
  isDisabled: false,
}));

const defaultProviders: InvestWidgetProviders = {
  accreditation: {
    useAlert: () => ({
      alertModel: hiddenAlert,
      isDataLoading: computed(() => false),
      onPrimaryAction: noop,
      onDescriptionAction: noop,
    }),
    useButton: () => ({
      data: computed(() => null),
      tagBackground: computed(() => 'yellow'),
      onClick: noop,
    }),
  },
  kyc: {
    useAlert: () => ({
      alertModel: hiddenKycAlert,
      isDataLoading: computed(() => false),
      onPrimaryAction: noopAsync,
      onDescriptionAction: noop,
    }),
  },
  notifications: {
    useSidebar: () => ({
      loadData: noop,
      onSidebarToggle: noop,
      isSidebarOpen: computed(() => false),
    }),
  },
  filer: {
    getCurrentUserId: () => undefined,
    getFilerUrl: () => '',
    uploadFile: async () => {
      throw new Error('Filer widget provider is not configured.');
    },
    reportError: noop,
  },
  profiles: {
    useProfileSwitchMenu: () => ({
      profileItems: computed(() => []),
      selectedProfileLabel: computed(() => 'Investment Profile'),
      onSelectProfile: noopAsync,
    }),
  },
  walletAuth: {
    useDialog: () => ({
      codeValue: ref(''),
      isBusy: computed(() => false),
      isCodeStep: computed(() => false),
      isOtpStep: computed(() => false),
      isSuccessStep: computed(() => false),
      dialogTitle: computed(() => 'Confirm Transaction'),
      operationIntent: computed(() => null),
      operationSummaryScanBaseUrl: computed(() => ''),
      stepDescription: computed(() => ''),
      inputLabel: computed(() => 'Email Verification Code'),
      inputPlaceholder: computed(() => 'Enter email code'),
      inputHelperText: computed(() => 'Enter the 6-digit code we sent to your email.'),
      primaryButtonText: computed(() => 'Continue'),
      isPrimaryDisabled: computed(() => false),
      closeDialog: noop,
      handlePrimaryClick: noopAsync,
    }),
  },
};

const mergeProviders = (providers: Partial<InvestWidgetProviders> = {}): InvestWidgetProviders => ({
  accreditation: providers.accreditation ?? defaultProviders.accreditation,
  kyc: providers.kyc ?? defaultProviders.kyc,
  notifications: providers.notifications ?? defaultProviders.notifications,
  filer: providers.filer ?? defaultProviders.filer,
  profiles: providers.profiles ?? defaultProviders.profiles,
  walletAuth: providers.walletAuth ?? defaultProviders.walletAuth,
});

const widgetProvidersRef = shallowRef<InvestWidgetProviders>(defaultProviders);

export const investWidgetProvidersKey = Symbol('invest-widget-providers') as InjectionKey<Ref<InvestWidgetProviders>>;

export const setInvestWidgetProviders = (providers: Partial<InvestWidgetProviders>) => {
  widgetProvidersRef.value = mergeProviders(providers);
  return widgetProvidersRef.value;
};

export const resetInvestWidgetProvidersForTests = () => {
  widgetProvidersRef.value = defaultProviders;
};

export const installInvestWidgetProviders = (
  app: App,
  providers: Partial<InvestWidgetProviders>,
) => {
  const resolvedProviders = setInvestWidgetProviders(providers);
  app.provide(investWidgetProvidersKey, shallowRef(resolvedProviders));
};

export const provideInvestWidgetProviders = (
  providers: Partial<InvestWidgetProviders>,
) => {
  const resolvedProviders = setInvestWidgetProviders(providers);
  const providerRef = shallowRef(resolvedProviders);
  provide(investWidgetProvidersKey, providerRef);
  return providerRef;
};

export const useInvestWidgetProviders = () => {
  if (hasInjectionContext()) {
    const injectedProviders = inject(investWidgetProvidersKey, null);
    if (injectedProviders) {
      return injectedProviders.value;
    }
  }

  return widgetProvidersRef.value;
};
