// @ts-nocheck
import {
  computed, nextTick, ref, toRaw,
} from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { composeInvestmentFormSchema, createInvestmentAjv, prepareInvestmentFormData } from '@global-torque/invest-core/form-validation';
import { JSONSchemaType } from 'ajv/dist/types/json-schema';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';
import { getAuthLinks } from '../links.ts';
import { SELFSERVICE, AAL2_QUERY } from '@global-torque/domain-types/authConstants';
import { oryErrorHandling } from '@global-torque/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@global-torque/invest-runtime/error/oryResponseHandling';
import { notifyNativePushAuthSuccess } from '@global-torque/invest-runtime/native-push';
import { validateLocalPostAuthReturnPath } from '../navigation/invitationReturn.ts';

type FormModelTOTP = {
    totp_code: number;
}


export const useAuthenticatorStore = defineStore('authenticator', () => {
  const { profile: urlProfile } = getAuthLinks();
  const authRepository = useRepositoryAuth();
  const { getSchemaState, setLoginState } = storeToRefs(authRepository);
  const userSessionStore = useSessionStore();

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
          totp_code: {},
        },
        type: 'object',
        required: ['totp_code'],
      },
    },
    $ref: '#/definitions/Auth',
  } as unknown as JSONSchemaType<FormModelTOTP>));

  const schemaBackend = computed(() => (
    getSchemaState.value.data ? structuredClone(toRaw(getSchemaState.value.data)) : null));

  const fieldsPaths = ['totp_code'];

  const {
    model, validation, isValid, onValidate,
    scrollToError, formErrors, isFieldRequired, getErrorText,
    getOptions,
  } = useFormValidation<FormModelTOTP>(
    schemaFrontend,
    schemaBackend,
    {} as FormModelTOTP,
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
      nextTick(() => scrollToError('VFormAuthAuthenticator'));
      return false;
    }
    return true;
  };

  const navigateToProfile = () => {
    const redirectUrl = validateLocalPostAuthReturnPath(
      getQueryParam('redirect'),
      typeof window === 'undefined' ? '' : window.location.origin,
    ) || urlProfile();
    return navigateWithQueryParams(redirectUrl);
  };

  const handleSuccess = async (session: any) => {
    userSessionStore.updateSession(session);
    notifyNativePushAuthSuccess();
    navigateToProfile();
  };

  const totpHandler = async () => {
    if (!validateForm()) return;

    isLoading.value = true;
    try {
      await authRepository.setLogin(authRepository.flowId.value, {
        totp_code: model.totp_code.toString(),
        method: 'totp',
        csrf_token: authRepository.csrfToken.value,
      });

      if (setLoginState.value.error) {
        isLoading.value = false;
        return;
      }
    } catch (error) {
      await oryErrorHandling(error as any, 'login', () => authRepository.getAuthFlow(SELFSERVICE.login, AAL2_QUERY), 'Failed to login');
    } finally {
      isLoading.value = false;
    }

    if (setLoginState.value.data?.session) {
      await handleSuccess(setLoginState.value.data.session);
    }
  };

  const onMountedHandler = async () => {
    try {
      const flowData = await authRepository.getAuthFlow(SELFSERVICE.login, AAL2_QUERY);
      oryResponseHandling(flowData);
    } catch (error) {
      await oryErrorHandling(error as any, 'browser', () => {}, 'Failed to get auth flow');
    }
  };

  return {
    isLoading,
    model,
    validation,
    schemaBackend,
    schemaFrontend,
    isDisabledButton,
    setLoginState,
    totpHandler,
    onValidate,
    isValid,
    onMountedHandler,
    navigateToProfile,
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
  import.meta.hot.accept(acceptHMRUpdate(useAuthenticatorStore, import.meta.hot));
}
