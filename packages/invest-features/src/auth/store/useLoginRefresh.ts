// @ts-nocheck
import {
  computed, nextTick, ref, toRaw,
} from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { JSONSchemaType } from 'ajv/dist/types/json-schema';
import { composeInvestmentFormSchema, createInvestmentAjv, emailRule, errorMessageRule, passwordRule, prepareInvestmentFormData } from '@global-torque/invest-core/form-validation';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { useDialogs } from '@global-torque/invest-runtime/dialogs';
import { SELFSERVICE } from '@global-torque/domain-types/authConstants';
import { oryErrorHandling } from '@global-torque/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@global-torque/invest-runtime/error/oryResponseHandling';
import { useSendAnalyticsEvent } from '@global-torque/invest-runtime/analytics/useSendAnalyticsEvent';

type FormModelSignIn = {
  email: string;
  password: string;
}


export const useLoginRefreshStore = defineStore('loginRefresh', () => {
  const authRepository = useRepositoryAuth();
  const { getSchemaState, setLoginState, getAuthFlowState } = storeToRefs(authRepository);
  const userSessionStore = useSessionStore();
  const useDialogsStore = useDialogs();
  const { completeSessionRefresh } = useDialogsStore; // Direct access, not storeToRefs
  const { sendEvent } = useSendAnalyticsEvent();

  const resetLoginRefreshFlow = () => {
    void authRepository
      .getAuthFlow(SELFSERVICE.login, { refresh: true } as any)
      .then((flow) => oryResponseHandling(flow as any));
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

  const {
    model, validation, isValid, onValidate,
    scrollToError, formErrors, isFieldRequired, getErrorText,
    getOptions,
  } = useFormValidation<FormModelSignIn>(
    schemaFrontend,
    schemaBackend,
    {} as FormModelSignIn,
    fieldsPaths,
    {
      createAjv: createInvestmentAjv,
      composeSchema: composeInvestmentFormSchema,
      prepareData: prepareInvestmentFormData,
    }
  );

  const isLoading = ref(false);
  const isDisabledButton = computed(() => !isValid.value || isLoading.value);

  // Form validation
  const validateForm = () => {
    onValidate();
    if (!isValid.value) {
      nextTick(() => scrollToError('VFormAuthLogInRefresh'));
      return false;
    }
    return true;
  };

  const buildPasswordLoginRefreshRequestBody = () => ({
    identifier: model.email,
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
    if (!validateForm()) return;

    let loginRefreshRequestBody: ReturnType<typeof buildPasswordLoginRefreshRequestBody> | undefined;
    isLoading.value = true;
    try {
      const flowData = await authRepository.getAuthFlow(SELFSERVICE.login, { refresh: true });
      oryResponseHandling(flowData);
      if (getAuthFlowState.value.error) {
        isLoading.value = false;
        return;
      }

      loginRefreshRequestBody = buildPasswordLoginRefreshRequestBody();
      await authRepository.setLogin(authRepository.flowId.value, loginRefreshRequestBody);

      if (setLoginState.value.error) {
        isLoading.value = false;
        void trackLoginRefreshEvent(400, loginRefreshRequestBody);
        return;
      }

      if (setLoginState.value.data?.session) {
        const session = setLoginState.value.data.session;
        userSessionStore.updateSession(session);
        await trackLoginRefreshEvent(200, loginRefreshRequestBody);
        completeSessionRefresh(true); // Success - complete the session refresh
      }
    } catch (error) {
      await oryErrorHandling(
        error as any,
        'login',
        resetLoginRefreshFlow,
        'Failed to login',
      );
      completeSessionRefresh(false); // Failure - complete with false
      void trackLoginRefreshEvent(400, loginRefreshRequestBody ?? buildPasswordLoginRefreshRequestBody());
    } finally {
      isLoading.value = false;
    }
  };

  const loginSocialHandler = async (provider: string) => {
    let loginRefreshRequestBody: ReturnType<typeof buildSocialLoginRefreshRequestBody> | undefined;
    isLoading.value = true;
    try {
      const flowId = getQueryParam('flow');
      if (!flowId) {
        const flowData = await authRepository.getAuthFlow(SELFSERVICE.login, { refresh: true });
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
      await oryErrorHandling(
        error as any,
        'login',
        resetLoginRefreshFlow,
        'Failed to login',
      );
      completeSessionRefresh(false); // Failure
    } finally {
      isLoading.value = false;
    }
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
    loginPasswordHandler,
    loginSocialHandler,
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
