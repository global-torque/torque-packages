// @ts-nocheck
import { computed, nextTick, ref, toRaw, watch } from 'vue';
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

export const useLoginRefreshStore = defineStore('loginRefresh', () => {
  const authRepository = useRepositoryAuth();
  const { getSchemaState, setLoginState, getAuthFlowState } = storeToRefs(authRepository);
  const userSessionStore = useSessionStore();
  const { userSession } = storeToRefs(userSessionStore);
  const { completeSessionRefresh } = useDialogs();
  const { sendEvent } = useSendAnalyticsEvent();

  const trackLoginRefreshEvent = (statusCode: number, body?: unknown) => {
    const uiPath = typeof window !== 'undefined' ? window.location.pathname : '';
    void sendEvent({
      event_type: 'send',
      method: 'POST',
      httpRequestMethod: 'POST',
      request_id: authRepository.flowId.value,
      request_path: uiPath,
      httpRequestUrl: `${SELFSERVICE.login}?refresh=true`,
      status_code: statusCode,
      body,
    }).catch(() => undefined);
  };

  // Form schema and validation
  const schemaFrontend = computed(() => ({
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
  } as unknown as JSONSchemaType<FormModelSignIn>));

  const schemaBackend = computed(() => (
    getSchemaState.value.data ? structuredClone(toRaw(getSchemaState.value.data)) : null));

  const fieldsPaths = ['password'];

  const { model, isValid, onValidate, scrollToError, isFieldRequired, getErrorText, resetValidation } = useFormValidation<FormModelSignIn>(
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
  const sessionEmail = computed(() => userSession.value?.identity?.traits?.email ?? '');
  const isDisabledButton = computed(() => !sessionEmail.value || !isValid.value || isLoading.value);

  let requestCounter = 0;
  const resetForm = () => {
    requestCounter += 1;
    model.password = '';
    resetValidation();
    setLoginState.value.error = null;
  };

  watch(sessionEmail, resetForm, { flush: 'sync' });

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

  const loginPasswordHandler = async () => {
    if (isLoading.value || !sessionEmail.value || !validateForm()) return;

    let loginRefreshRequestBody: ReturnType<typeof buildPasswordLoginRefreshRequestBody> | undefined;
    const email = sessionEmail.value;
    const requestAtStart = requestCounter;
    isLoading.value = true;
    try {
      const flowData = await authRepository.getAuthFlow(SELFSERVICE.login, { refresh: true });
      if (requestAtStart !== requestCounter) return;
      oryResponseHandling(flowData);
      if (getAuthFlowState.value.error) {
        return;
      }

      loginRefreshRequestBody = buildPasswordLoginRefreshRequestBody(email);
      await authRepository.setLogin(authRepository.flowId.value, loginRefreshRequestBody);
      if (requestAtStart !== requestCounter) return;

      if (setLoginState.value.error) {
        trackLoginRefreshEvent(400, loginRefreshRequestBody);
        return;
      }

      if (setLoginState.value.data?.session) {
        const session = setLoginState.value.data.session;
        userSessionStore.updateSession(session);
        resetForm();
        completeSessionRefresh(true);
        trackLoginRefreshEvent(200, loginRefreshRequestBody);
      }
    } catch (error) {
      if (requestAtStart !== requestCounter) return;
      await oryErrorHandling(error as any, 'login', () => undefined, 'Failed to login');
      if (requestAtStart !== requestCounter) return;
      trackLoginRefreshEvent(400, loginRefreshRequestBody ?? buildPasswordLoginRefreshRequestBody(email));
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    model,
    sessionEmail,
    isDisabledButton,
    loginPasswordHandler,
    resetForm,
    isFieldRequired,
    getErrorText,
    setLoginState,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLoginRefreshStore, import.meta.hot));
}
