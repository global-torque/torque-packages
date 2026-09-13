import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { SELFSERVICE } from '@global-torque/domain-types/authConstants';
import { getAuthLinks } from '../links.ts';
import { oryErrorHandling } from '@global-torque/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@global-torque/invest-runtime/error/oryResponseHandling';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';
import { notifyNativePushAuthSuccess } from '@global-torque/invest-runtime/native-push';

type DemoAccountCredentialsConfig = {
  email: string;
  password: string;
};

type DemoAccountCredentialsSource = {
  DEMO_ACCOUNT_EMAIL?: string;
  DEMO_ACCOUNT_PASSWORD?: string;
};

const DEMO_ACCOUNT_DISABLED_TRIGGER_VALUES = new Set(['0', 'false', 'no', 'off']);
export const DEMO_ACCOUNT_TRIGGER_QUERY_PARAM = 'tryDemo';

export type DemoAccountAuthProvider = {
  authenticate: () => Promise<boolean>;
  isAvailable: ComputedRef<boolean>;
  isLoading: Ref<boolean>;
};

const getDemoAccountCredentialsSource = (): DemoAccountCredentialsSource => ({
  DEMO_ACCOUNT_EMAIL: useInvestApplicationContext().appConfig.demoAccount?.email,
  DEMO_ACCOUNT_PASSWORD: useInvestApplicationContext().appConfig.demoAccount?.password,
});

export const resolveDemoAccountCredentialsConfig = (
  source = getDemoAccountCredentialsSource(),
): DemoAccountCredentialsConfig | null => {
  const email = source.DEMO_ACCOUNT_EMAIL?.trim();
  const password = source.DEMO_ACCOUNT_PASSWORD?.trim();

  if (!email || !password) {
    return null;
  }

  return {
    email,
    password,
  };
};

export const resolveDemoAccountRedirect = (search: string) => {
  const params = new URLSearchParams(search);
  return params.get('redirect') || getAuthLinks().profile();
};

export const shouldAutoAuthenticateDemoAccount = (search: string) => {
  const params = new URLSearchParams(search);
  const rawTrigger = params.get(DEMO_ACCOUNT_TRIGGER_QUERY_PARAM);

  if (rawTrigger === null) {
    return false;
  }

  const triggerValue = rawTrigger.trim().toLowerCase();
  return !DEMO_ACCOUNT_DISABLED_TRIGGER_VALUES.has(triggerValue);
};

export const createPasswordDemoAccountProvider = (): DemoAccountAuthProvider => {
  const authRepository = useRepositoryAuth();
  const sessionStore = useSessionStore();
  const isLoading = ref(false);

  const resetDemoLoginFlow = () => {
    void authRepository
      .getAuthFlow(SELFSERVICE.login)
      .then((flow) => oryResponseHandling(flow as any));
  };

  const isAvailable = computed(() => Boolean(resolveDemoAccountCredentialsConfig()));

  const authenticate = async () => {
    const credentials = resolveDemoAccountCredentialsConfig();

    if (!credentials || isLoading.value || typeof window === 'undefined') {
      return false;
    }

    isLoading.value = true;

    try {
      const flow = await authRepository.getAuthFlow(SELFSERVICE.login);
      oryResponseHandling(flow as any);

      if (authRepository.getAuthFlowState.value.error) {
        return false;
      }

      await authRepository.setLogin(authRepository.flowId.value, {
        identifier: credentials.email,
        password: credentials.password,
        method: 'password',
        csrf_token: authRepository.csrfToken.value,
      });

      const session = authRepository.setLoginState.value.data?.session;

      if (authRepository.setLoginState.value.error || !session) {
        return false;
      }

      sessionStore.updateSession(session);
      notifyNativePushAuthSuccess();
      navigateWithQueryParams(resolveDemoAccountRedirect(window.location.search));

      return true;
    } catch (error) {
      await oryErrorHandling(
        error as any,
        'login',
        resetDemoLoginFlow,
        'Failed to login demo account',
      );

      return false;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    authenticate,
    isAvailable,
    isLoading,
  };
};

export const useDemoAccountAuth = () => createPasswordDemoAccountProvider();
