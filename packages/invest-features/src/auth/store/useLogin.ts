// @ts-nocheck
import {
  computed, nextTick, ref, toRaw,
} from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { navigateWithQueryParams } from '@webdevelop-pro/invest-runtime/navigation';
import { getAuthLinks } from '../links.ts';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { JSONSchemaType } from 'ajv/dist/types/json-schema';
import { composeInvestmentFormSchema, createInvestmentAjv, emailRule, errorMessageRule, passwordRule, prepareInvestmentFormData } from '@webdevelop-pro/invest-core/form-validation';
import { useSessionStore } from '@webdevelop-pro/invest-runtime/session';
import { SELFSERVICE } from '@webdevelop-pro/domain-types/authConstants';
import { oryErrorHandling } from '@webdevelop-pro/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@webdevelop-pro/invest-runtime/error/oryResponseHandling';
import { useSendAnalyticsEvent } from '@webdevelop-pro/invest-runtime/analytics/useSendAnalyticsEvent';
import {
  shouldAutoAuthenticateDemoAccount,
  useDemoAccountAuth,
} from '../composables/useDemoAccountAuth.ts';
import { notifyNativePushAuthSuccess } from '@webdevelop-pro/invest-runtime/native-push';
import {
  buildCanonicalInvitationPath,
  buildCanonicalInvitationUrl,
  recoverInvitationCodeFromReturn,
  recoverRememberedInvitationReturn,
  rememberInvitationReturnForFlow,
  validateLocalPostAuthReturnPath,
} from '../navigation/invitationReturn.ts';

type FormModelSignIn = {
  email: string;
  password: string;
}


export const useLoginStore = defineStore('login', () => {
  const {
    signup: urlSignup,
    signin: urlSignin,
    profile: urlProfile,
    authenticator: urlAuthenticator,
  } = getAuthLinks();
  const authRepository = useRepositoryAuth();
  const {
    getSchemaState, setLoginState, getAuthFlowState, getLoginState,
  } = storeToRefs(authRepository);
  const userSessionStore = useSessionStore();
  const { sendEvent } = useSendAnalyticsEvent();
  const demoAccountAuth = useDemoAccountAuth();
  const recoveredInvitationPath = ref<string | null>(null);
  const isAuthReturnResolved = ref(false);

  const currentOrigin = () => (typeof window === 'undefined' ? '' : window.location.origin);

  const invitationReturnPath = (): string | null => {
    const origin = currentOrigin();
    if (!origin) return null;
    const redirect = getQueryParam('redirect');
    const code = recoverInvitationCodeFromReturn(redirect, origin);
    return code ? buildCanonicalInvitationPath(code) : recoveredInvitationPath.value;
  };

  const invitationReturnUrl = (): string | null => {
    const path = invitationReturnPath();
    if (!path) return null;
    const code = recoverInvitationCodeFromReturn(path, currentOrigin());
    return code ? buildCanonicalInvitationUrl(code, currentOrigin()) : null;
  };
  const authHeaderState = computed(() => ({
    disabled: Boolean(getQueryParam('flow')) && !isAuthReturnResolved.value,
    signInHref: urlSignin,
    signUpHref: invitationReturnPath() || urlSignup,
    suppressAuthenticatedAccountControls: false,
  }));

  const rememberCurrentInvitationFlow = () => {
    rememberInvitationReturnForFlow({
      flowId: authRepository.flowId.value,
      invitationReturn: invitationReturnPath(),
      origin: currentOrigin(),
    });
  };

  const resetLoginFlow = () => {
    const returnTo = invitationReturnUrl();
    void authRepository
      .getAuthFlow(SELFSERVICE.login, returnTo ? { return_to: returnTo } : undefined)
      .then((flow) => {
        oryResponseHandling(flow as any);
        rememberCurrentInvitationFlow();
      });
  };

  const trackLoginEvent = async (statusCode: number, body?: unknown) => {
    const uiPath = typeof window !== 'undefined' ? window.location.pathname : '';
    await sendEvent({
      event_type: 'send',
      method: 'POST',
      httpRequestMethod: 'POST',
      request_id: authRepository.flowId.value,
      request_path: uiPath,
      httpRequestUrl: SELFSERVICE.login,
      status_code: statusCode,
      body,
    });
  };

  // Query parameters handling
  const queryParams = computed(() => {
    if (import.meta.env.SSR) return new Map<string, string>();
    return new Map(Object.entries(Object.fromEntries(new URLSearchParams(window?.location?.search))));
  });

  const getQueryParam = (key: string): string | undefined => queryParams.value.get(key);

  // Form schema and validation
  const schemaFrontend = computed(() => ({
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: {
      Auth: {
        properties: {
          email: emailRule,
          password: passwordRule,
        },
        type: 'object',
        errorMessage: errorMessageRule,
        required: ['email', 'password'],
      },
    },
    $ref: '#/definitions/Auth',
  } as unknown as JSONSchemaType<FormModelSignIn>));

  const schemaBackend = computed(() => (
    getSchemaState.value.data ? structuredClone(toRaw(getSchemaState.value.data)) : null));

  const fieldsPaths = ['email', 'password'];
  const initModel = computed(() => (getQueryParam('email') ? { email: getQueryParam('email') } : {}));

  const {
    model, validation, isValid, onValidate,
    scrollToError, formErrors, isFieldRequired, getErrorText,
    getOptions,
  } = useFormValidation<FormModelSignIn>(
    schemaFrontend,
    schemaBackend,
    initModel.value as FormModelSignIn,
    fieldsPaths,
    {
      createAjv: createInvestmentAjv,
      composeSchema: composeInvestmentFormSchema,
      prepareData: prepareInvestmentFormData,
    }
  );

  const isLoading = ref(false);
  const isDisabledButton = computed(() => !isValid.value || isLoading.value);

  // Navigation
  const onSignup = () => {
    const returnPath = invitationReturnPath();
    if (returnPath) return navigateWithQueryParams(returnPath);
    const params = queryParams.value.size ? queryParams.value : undefined;
    return navigateWithQueryParams(urlSignup, params);
  };

  // Form validation
  const validateForm = () => {
    onValidate();
    if (!isValid.value) {
      nextTick(() => scrollToError('LogInForm'));
      return false;
    }
    return true;
  };

  // Login handlers
  const handleLoginSuccess = async () => {
    const redirect = validateLocalPostAuthReturnPath(
      invitationReturnPath() || getQueryParam('redirect'),
      currentOrigin(),
    );
    navigateWithQueryParams(redirect || urlProfile());
  };

  const buildPasswordLoginRequestBody = () => ({
    identifier: model.email,
    password: model.password,
    method: 'password' as const,
    csrf_token: authRepository.csrfToken.value,
  });

  const buildSocialLoginRequestBody = (provider: string) => ({
    csrf_token: authRepository.csrfToken.value,
    provider,
    method: 'oidc' as const,
  });

  const loginPasswordHandler = async () => {
    if (!validateForm()) return;

    let loginRequestBody: ReturnType<typeof buildPasswordLoginRequestBody> | undefined;
    isLoading.value = true;
    try {
      const returnTo = invitationReturnUrl();
      const flowData = await authRepository.getAuthFlow(
        SELFSERVICE.login,
        returnTo ? { return_to: returnTo } : undefined,
      );
      oryResponseHandling(flowData);
      rememberCurrentInvitationFlow();
      if (getAuthFlowState.value.error) {
        isLoading.value = false;
        return;
      }

      loginRequestBody = buildPasswordLoginRequestBody();
      await authRepository.setLogin(authRepository.flowId.value, loginRequestBody);

      if (setLoginState.value.error) {
        void trackLoginEvent(400, loginRequestBody);
        isLoading.value = false;
        return;
      }
    } catch (error) {
      void trackLoginEvent(400, loginRequestBody ?? buildPasswordLoginRequestBody());
      await oryErrorHandling(
        error as any,
        'login',
        resetLoginFlow,
        'Failed to login',
        undefined,
        { postAuthReturnPath: invitationReturnPath() },
      );
    } finally {
      isLoading.value = false;
    }

    if (setLoginState.value.data?.session && loginRequestBody) {
      const session = setLoginState.value.data.session;
      userSessionStore.updateSession(session);
      notifyNativePushAuthSuccess();
      await trackLoginEvent(200, loginRequestBody);
      await handleLoginSuccess();
    }
  };

  const loginSocialHandler = async (provider: string) => {
    let loginRequestBody: ReturnType<typeof buildSocialLoginRequestBody> | undefined;
    isLoading.value = true;
    try {
      const flowId = getQueryParam('flow');
      const returnTo = invitationReturnUrl();
      const flowData = await authRepository.getAuthFlow(
        SELFSERVICE.login,
        returnTo ? { return_to: returnTo } : undefined,
      );
      oryResponseHandling(flowData);
      rememberCurrentInvitationFlow();
      if (getAuthFlowState.value.error) return;

      loginRequestBody = buildSocialLoginRequestBody(provider);
      await authRepository.setLogin(flowId || authRepository.flowId.value, loginRequestBody);
    } catch (error) {
      void trackLoginEvent(400, loginRequestBody ?? buildSocialLoginRequestBody(provider));
      await oryErrorHandling(
        error as any,
        'login',
        resetLoginFlow,
        'Failed to login',
        undefined,
        { postAuthReturnPath: invitationReturnPath() },
      );
    } finally {
      isLoading.value = false;
    }
  };

  const demoAccountHandler = async () => demoAccountAuth.authenticate();

  const onMountedHandler = async () => {
    const currentFlowId = getQueryParam('flow');

    if (currentFlowId) {
      recoveredInvitationPath.value = recoverRememberedInvitationReturn({
        flowId: currentFlowId,
        origin: currentOrigin(),
      });
      try {
        const data = await authRepository.getLogin(currentFlowId);
        oryResponseHandling(data);
        const code = recoverInvitationCodeFromReturn(
          (data as { return_to?: string } | undefined)?.return_to,
          currentOrigin(),
        );
        recoveredInvitationPath.value = code
          ? buildCanonicalInvitationPath(code)
          : recoveredInvitationPath.value;
        isAuthReturnResolved.value = true;
        if (getLoginState.value.data?.requested_aal === 'aal2') {
          navigateWithQueryParams(
            urlAuthenticator,
            recoveredInvitationPath.value
              ? { redirect: recoveredInvitationPath.value }
              : undefined,
          );
        }
      } catch (error) {
        await oryErrorHandling(
          error as any,
          'login',
          resetLoginFlow,
          'Failed to get login data',
          undefined,
          { postAuthReturnPath: invitationReturnPath() },
        );
        isAuthReturnResolved.value = true;
      }

      return;
    }

    isAuthReturnResolved.value = true;

    if (typeof window === 'undefined' || !shouldAutoAuthenticateDemoAccount(window.location.search)) {
      return;
    }

    await demoAccountHandler();
  };

  return {
    queryParams,
    isLoading,
    model,
    validation,
    schemaBackend,
    schemaFrontend,
    isDisabledButton,
    setLoginState,
    onSignup,
    loginPasswordHandler,
    loginSocialHandler,
    demoAccountHandler,
    isDemoAccountAvailable: demoAccountAuth.isAvailable,
    isDemoAccountLoading: demoAccountAuth.isLoading,
    onValidate,
    isValid,
    getQueryParam,
    onMountedHandler,
    isAuthReturnResolved,
    invitationReturnPath,
    authHeaderState,
    // Form validation helpers
    formErrors,
    isFieldRequired,
    getErrorText,
    getOptions,
    scrollToError,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLoginStore, import.meta.hot));
}
