// @ts-nocheck
import { computed, nextTick, ref, toRaw, unref, watch } from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { JSONSchemaType } from 'ajv/dist/types/json-schema';
import { composeInvestmentFormSchema, createInvestmentAjv, errorMessageRule, passwordRule, prepareInvestmentFormData } from '@global-torque/invest-core/form-validation';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { useDialogs } from '@global-torque/invest-runtime/dialogs';
import { SELFSERVICE } from '@global-torque/domain-types/authConstants';
import { oryErrorHandling } from '@global-torque/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@global-torque/invest-runtime/error/oryResponseHandling';
import { useSendAnalyticsEvent } from '@global-torque/invest-runtime/analytics/useSendAnalyticsEvent';

type FormModelSignIn = {
  password: string;
};

type SessionIdentitySnapshot = {
  id: string;
  email: string;
};

export const useLoginRefreshStore = defineStore('loginRefresh', () => {
  const authRepository = useRepositoryAuth();
  const { getSchemaState, setLoginState, getAuthFlowState } = storeToRefs(authRepository);
  const userSessionStore = useSessionStore();
  const useDialogsStore = useDialogs();
  const { completeSessionRefresh } = useDialogsStore; // Direct access, not storeToRefs
  const { sendEvent } = useSendAnalyticsEvent();

  const readSessionIdentity = (): SessionIdentitySnapshot => {
    const session = unref((userSessionStore as any).userSession) as any;
    const identity = session?.identity;
    const id = typeof identity?.id === 'string' ? identity.id.trim() : '';
    const email = typeof identity?.traits?.email === 'string' ? identity.traits.email.trim() : '';
    return { id, email };
  };

  const identityKey = (identity: SessionIdentitySnapshot) => `${identity.id}\u0000${identity.email.toLowerCase()}`;

  let observedIdentityKey = identityKey(readSessionIdentity());
  let dialogGeneration = 0;
  let completedGeneration: number | null = null;
  let dialogOpen = false;
  let refreshRequestInFlight = false;

  const resetLoginRefreshFlow = () => {
    void authRepository.getAuthFlow(SELFSERVICE.login, { refresh: true } as any).then((flow) => oryResponseHandling(flow as any));
  };

  const trackLoginRefreshEvent = async (statusCode: number, body?: unknown) => {
    const uiPath = typeof window !== 'undefined' ? window.location.pathname : '';
    await sendEvent({
      event_type: 'send',
      method: 'POST',
      httpRequestMethod: 'POST',
      request_id: authRepository.flowId.value,
      request_path: uiPath,
      httpRequestUrl: `${SELFSERVICE.login}?refresh=true`,
      status_code: statusCode,
      body,
    });
  };

  const trackLoginRefreshEventSafely = (statusCode: number, body?: unknown) => {
    void trackLoginRefreshEvent(statusCode, body).catch(() => undefined);
  };

  // Query parameters handling
  const queryParams = computed(() => {
    if (import.meta.env.SSR) return new Map<string, string>();
    return new Map(Object.entries(Object.fromEntries(new URLSearchParams(window?.location?.search))));
  });

  const getQueryParam = (key: string): string | undefined => queryParams.value.get(key);

  // Form schema and validation
  const schemaFrontend = computed(
    () =>
      ({
        $schema: 'http://json-schema.org/draft-07/schema#',
        definitions: {
          Auth: {
            properties: {
              password: passwordRule,
            },
            type: 'object',
            errorMessage: errorMessageRule,
            required: ['password'],
          },
        },
        $ref: '#/definitions/Auth',
      }) as unknown as JSONSchemaType<FormModelSignIn>,
  );

  const schemaBackend = computed(() => (getSchemaState.value.data ? structuredClone(toRaw(getSchemaState.value.data)) : null));

  const fieldsPaths = ['password'];

  const { model, validation, isValid, onValidate, scrollToError, formErrors, isFieldRequired, getErrorText, resetValidation, getOptions } = useFormValidation<FormModelSignIn>(
    schemaFrontend,
    schemaBackend,
    { password: '' },
    fieldsPaths,
    {
      createAjv: createInvestmentAjv,
      composeSchema: composeInvestmentFormSchema,
      prepareData: prepareInvestmentFormData,
    },
  );

  const isLoading = ref(false);
  const loginError = ref<unknown>(null);
  const sessionEmail = computed(() => readSessionIdentity().email);
  const isDisabledButton = computed(() => !sessionEmail.value || !isValid.value || isLoading.value || refreshRequestInFlight);
  const loginErrorText = computed(() => {
    const responseMessages = getErrorText('password', (loginError.value as any)?.data?.responseJson) ?? [];
    if (responseMessages.length) return responseMessages;
    return loginError.value ? ['Unable to confirm your password. Please try again.'] : [];
  });

  const resetSensitiveState = () => {
    model.password = '';
    resetValidation();
    loginError.value = null;
  };

  const invalidateDialogGeneration = () => {
    dialogGeneration += 1;
    completedGeneration = null;
    resetSensitiveState();
  };

  const beginRefreshSessionDialog = () => {
    dialogOpen = true;
    observedIdentityKey = identityKey(readSessionIdentity());
    invalidateDialogGeneration();
  };

  const dismissRefreshSessionDialog = () => {
    const shouldComplete = dialogOpen && completedGeneration !== dialogGeneration;
    dialogOpen = false;
    invalidateDialogGeneration();
    return shouldComplete;
  };

  const syncSessionIdentity = () => {
    const nextIdentityKey = identityKey(readSessionIdentity());
    if (nextIdentityKey === observedIdentityKey) return;

    observedIdentityKey = nextIdentityKey;
    if (completedGeneration === dialogGeneration) return;
    invalidateDialogGeneration();
  };

  const isAttemptCurrent = (generation: number, attemptIdentityKey: string) => {
    syncSessionIdentity();
    return generation === dialogGeneration && (completedGeneration === generation || attemptIdentityKey === identityKey(readSessionIdentity()));
  };

  watch(
    () => identityKey(readSessionIdentity()),
    (nextIdentityKey, previousIdentityKey) => {
      if (nextIdentityKey === previousIdentityKey || nextIdentityKey === observedIdentityKey) return;
      observedIdentityKey = nextIdentityKey;
      if (completedGeneration === dialogGeneration) return;
      invalidateDialogGeneration();
    },
  );

  // Form validation
  const validateForm = () => {
    onValidate();
    if (!isValid.value) {
      nextTick(() => scrollToError('VFormAuthLogInRefresh'));
      return false;
    }
    return true;
  };

  const buildPasswordLoginRefreshRequestBody = (identifier: string) => ({
    identifier,
    password: model.password,
    method: 'password' as const,
    csrf_token: authRepository.csrfToken.value,
  });

  const buildSocialLoginRefreshRequestBody = (provider: string) => ({
    csrf_token: authRepository.csrfToken.value,
    provider,
    method: 'oidc' as const,
  });

  const loginPasswordHandler = async () => {
    syncSessionIdentity();
    if (refreshRequestInFlight) return;
    const currentIdentity = readSessionIdentity();
    if (!currentIdentity.id || !currentIdentity.email) return;
    if (!validateForm()) return;

    let loginRefreshRequestBody: ReturnType<typeof buildPasswordLoginRefreshRequestBody> | undefined;
    const attemptGeneration = dialogGeneration;
    const attemptIdentityKey = identityKey(currentIdentity);
    refreshRequestInFlight = true;
    isLoading.value = true;
    loginError.value = null;
    try {
      const flowData = await authRepository.getAuthFlow(SELFSERVICE.login, {
        refresh: true,
      });
      if (!isAttemptCurrent(attemptGeneration, attemptIdentityKey)) return;
      oryResponseHandling(flowData);
      if (!isAttemptCurrent(attemptGeneration, attemptIdentityKey)) return;
      if (getAuthFlowState.value.error) {
        loginError.value = getAuthFlowState.value.error;
        return;
      }

      loginRefreshRequestBody = buildPasswordLoginRefreshRequestBody(currentIdentity.email);
      await authRepository.setLogin(authRepository.flowId.value, loginRefreshRequestBody);
      if (!isAttemptCurrent(attemptGeneration, attemptIdentityKey)) return;

      if (setLoginState.value.error) {
        loginError.value = setLoginState.value.error;
        trackLoginRefreshEventSafely(400, loginRefreshRequestBody);
        if (!isAttemptCurrent(attemptGeneration, attemptIdentityKey)) return;
        return;
      }

      if (setLoginState.value.data?.session) {
        const session = setLoginState.value.data.session;
        completedGeneration = attemptGeneration;
        if (!isAttemptCurrent(attemptGeneration, attemptIdentityKey)) return;
        userSessionStore.updateSession(session);
        if (!isAttemptCurrent(attemptGeneration, attemptIdentityKey)) return;
        completeSessionRefresh(true); // Success - complete the session refresh
        resetSensitiveState();
        trackLoginRefreshEventSafely(200, loginRefreshRequestBody);
      }
    } catch (error) {
      if (!isAttemptCurrent(attemptGeneration, attemptIdentityKey)) return;
      loginError.value = error;
      await oryErrorHandling(error as any, 'login', () => undefined, 'Failed to login');
      if (!isAttemptCurrent(attemptGeneration, attemptIdentityKey)) return;
      trackLoginRefreshEventSafely(400, loginRefreshRequestBody ?? buildPasswordLoginRefreshRequestBody(currentIdentity.email));
    } finally {
      refreshRequestInFlight = false;
      isLoading.value = false;
    }
  };

  const loginSocialHandler = async (provider: string) => {
    let loginRefreshRequestBody: ReturnType<typeof buildSocialLoginRefreshRequestBody> | undefined;
    isLoading.value = true;
    try {
      const flowId = getQueryParam('flow');
      if (!flowId) {
        const flowData = await authRepository.getAuthFlow(SELFSERVICE.login, {
          refresh: true,
        });
        oryResponseHandling(flowData);
        if (getAuthFlowState.value.error) return;
      }

      loginRefreshRequestBody = buildSocialLoginRefreshRequestBody(provider);
      await authRepository.setLogin(flowId || authRepository.flowId.value, loginRefreshRequestBody);

      // Complete session refresh after successful social login
      if (setLoginState.value.data?.session) {
        userSessionStore.updateSession(setLoginState.value.data.session);
        completeSessionRefresh(true); // Success
      }
    } catch (error) {
      await oryErrorHandling(error as any, 'login', resetLoginRefreshFlow, 'Failed to login');
    } finally {
      isLoading.value = false;
    }
  };

  return {
    queryParams,
    isLoading,
    model,
    sessionEmail,
    loginError,
    loginErrorText,
    validation,
    schemaBackend,
    schemaFrontend,
    isDisabledButton,
    setLoginState,
    loginPasswordHandler,
    loginSocialHandler,
    beginRefreshSessionDialog,
    dismissRefreshSessionDialog,
    onValidate,
    isValid,
    getQueryParam,
    // Form validation helpers
    formErrors,
    isFieldRequired,
    getErrorText,
    getOptions,
    scrollToError,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLoginRefreshStore, import.meta.hot));
}
