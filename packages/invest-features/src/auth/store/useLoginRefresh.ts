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

  let dialogGeneration = 0;
  let dialogOpen = false;

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
  const loginError = ref<unknown>(null);
  const sessionEmail = computed(() => readSessionIdentity().email);
  const isDisabledButton = computed(() => !sessionEmail.value || !isValid.value || isLoading.value);
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
    resetSensitiveState();
  };

  const beginRefreshSessionDialog = () => {
    dialogOpen = true;
    invalidateDialogGeneration();
  };

  const dismissRefreshSessionDialog = () => {
    const shouldComplete = dialogOpen;
    dialogOpen = false;
    invalidateDialogGeneration();
    return shouldComplete;
  };

  watch(
    [
      () => readSessionIdentity().id,
      () => readSessionIdentity().email.toLowerCase(),
    ],
    () => invalidateDialogGeneration(),
    { flush: 'sync' },
  );

  const isAttemptCurrent = (generation: number) => generation === dialogGeneration;

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
    if (isLoading.value) return;
    const currentIdentity = readSessionIdentity();
    if (!currentIdentity.id || !currentIdentity.email) return;
    if (!validateForm()) return;

    let loginRefreshRequestBody: ReturnType<typeof buildPasswordLoginRefreshRequestBody> | undefined;
    const attemptGeneration = dialogGeneration;
    isLoading.value = true;
    loginError.value = null;
    try {
      const flowData = await authRepository.getAuthFlow(SELFSERVICE.login, {
        refresh: true,
      });
      if (!isAttemptCurrent(attemptGeneration)) return;
      oryResponseHandling(flowData);
      if (getAuthFlowState.value.error) {
        loginError.value = getAuthFlowState.value.error;
        return;
      }

      loginRefreshRequestBody = buildPasswordLoginRefreshRequestBody(currentIdentity.email);
      await authRepository.setLogin(authRepository.flowId.value, loginRefreshRequestBody);
      if (!isAttemptCurrent(attemptGeneration)) return;

      if (setLoginState.value.error) {
        loginError.value = setLoginState.value.error;
        trackLoginRefreshEventSafely(400, loginRefreshRequestBody);
        return;
      }

      if (setLoginState.value.data?.session) {
        const session = setLoginState.value.data.session;
        dialogOpen = false;
        resetSensitiveState();
        userSessionStore.updateSession(session);
        completeSessionRefresh(true); // Success - complete the session refresh
        trackLoginRefreshEventSafely(200, loginRefreshRequestBody);
      }
    } catch (error) {
      if (!isAttemptCurrent(attemptGeneration)) return;
      loginError.value = error;
      await oryErrorHandling(error as any, 'login', () => undefined, 'Failed to login');
      if (!isAttemptCurrent(attemptGeneration)) return;
      trackLoginRefreshEventSafely(400, loginRefreshRequestBody ?? buildPasswordLoginRefreshRequestBody(currentIdentity.email));
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    model,
    sessionEmail,
    loginError,
    loginErrorText,
    isDisabledButton,
    loginPasswordHandler,
    beginRefreshSessionDialog,
    dismissRefreshSessionDialog,
    isFieldRequired,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLoginRefreshStore, import.meta.hot));
}
