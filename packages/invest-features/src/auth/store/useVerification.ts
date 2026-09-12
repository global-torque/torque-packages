// @ts-nocheck
import {
  computed, nextTick, ref, toRaw,
} from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { JSONSchemaType } from 'ajv/dist/types/json-schema';
import { codeRule, composeInvestmentFormSchema, createInvestmentAjv, errorMessageRule, prepareInvestmentFormData } from '@webdevelop-pro/invest-core/form-validation';
import { toast } from '@global-torque/ui-primitives/sonner';
import { SELFSERVICE } from '@webdevelop-pro/domain-types/authConstants';
import type { IAuthFlow } from '@webdevelop-pro/domain-types/authTypes';
import { oryErrorHandling } from '@webdevelop-pro/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@webdevelop-pro/invest-runtime/error/oryResponseHandling';
import { getAuthLinks } from '../links.ts';
import { navigateWithQueryParams } from '@webdevelop-pro/invest-runtime/navigation';

type FormModelVerification = {
  code: string;
}

const TOAST_OPTIONS = {
  title: 'Something went wrong',
  description: 'Please try again',
  variant: 'error',
};

export const useVerificationStore = defineStore('verification', () => {
  const { resetPassword: urlResetPassword } = getAuthLinks();
  const authRepository = useRepositoryAuth();
  const { getSchemaState, setRecoveryState, getAuthFlowState } = storeToRefs(authRepository);

  const resetRecoveryFlow = () => {
    void authRepository
      .getAuthFlow(SELFSERVICE.recovery)
      .then((flow) => oryResponseHandling(flow as any));
  };

  // Query parameters handling
  const queryParams = computed(() => {
    if (import.meta.env.SSR) return new Map<string, string>();
    return new Map(Object.entries(Object.fromEntries(new URLSearchParams(window?.location?.search))));
  });

  const getQueryParam = (key: string): string | undefined => queryParams.value.get(key);

  const flowId = computed(() => getQueryParam('flowId'));
  const email = computed(() => getQueryParam('email'));

  const recoverySettingsFlowId = (flow: IAuthFlow): string | null => {
    const redirect = flow.continue_with?.find((continuation) => (
      continuation.action === 'redirect_browser_to'
      && typeof continuation.redirect_browser_to === 'string'
    ))?.redirect_browser_to;
    if (!redirect || typeof window === 'undefined') return null;
    try {
      const flowId = new URL(redirect, window.location.origin).searchParams.get('flow')?.trim();
      return flowId || null;
    }
    catch {
      return null;
    }
  };

  // Form schema and validation
  const schemaFrontend = computed(() => ({
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: {
      Auth: {
        properties: {
          code: codeRule,
        },
        type: 'object',
        required: ['code'],
        errorMessage: errorMessageRule,
      },
    },
    $ref: '#/definitions/Auth',
  } as unknown as JSONSchemaType<FormModelVerification>));

  const schemaBackend = computed(() => (
    getSchemaState.value.data ? structuredClone(toRaw(getSchemaState.value.data)) : null));

  const fieldsPaths = ['code'];

  const {
    model, validation, isValid, onValidate,
    scrollToError, formErrors, isFieldRequired, getErrorText,
    getOptions,
  } = useFormValidation<FormModelVerification>(
    schemaFrontend,
    schemaBackend,
    {} as FormModelVerification,
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
      nextTick(() => scrollToError('VFormAuthVerification'));
      return false;
    }
    return true;
  };

  // Verification handlers
  const verificationHandler = async () => {
    if (!validateForm()) return;

    isLoading.value = true;
    try {
      const flowData = await authRepository.getAuthFlow(SELFSERVICE.recovery);
      oryResponseHandling(flowData);
      if (getAuthFlowState.value.error) {
        isLoading.value = false;
        return;
      }
      await authRepository.setRecovery(flowId.value, {
        code: model.code,
        method: 'code',
        csrf_token: authRepository.csrfToken.value,
      });

      const recoveryState = setRecoveryState.value;
      if (recoveryState.error || !recoveryState.data) return;

      const uiMessage = recoveryState.data.ui?.messages?.find((m: any) => m.type === 'error')?.text;
      const uiNodeMessage = recoveryState.data.ui?.nodes?.find((node: any) => node.messages?.some((m: any) => m.type === 'error'))?.messages?.find((m: any) => m.type === 'error')?.text;

      // Check if there are any error messages in the UI structure
      const hasErrorMessages = recoveryState.data.ui?.messages?.some((m: any) => m.type === 'error');
      const hasErrorNodes = recoveryState.data.ui?.nodes?.some((node: any) => node.messages?.some((m: any) => m.type === 'error'));

      if (hasErrorMessages || hasErrorNodes) {
        const errorMessage = uiMessage || uiNodeMessage || TOAST_OPTIONS.description;
        toast.error('Failed to set recovery', {
          description: errorMessage,
        });
        return;
      }

      const settingsFlowId = recoverySettingsFlowId(recoveryState.data);
      if (!settingsFlowId) {
        toast('The password recovery settings flow is incomplete.', {
          ...TOAST_OPTIONS,
        });
        return;
      }
      navigateWithQueryParams(urlResetPassword, { flow: settingsFlowId });
    } catch (error) {
      await oryErrorHandling(
        error as any,
        'recovery',
        resetRecoveryFlow,
        'Failed to set recovery',
      );
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
    setRecoveryState,
    verificationHandler,
    onValidate,
    isValid,
    getQueryParam,
    flowId,
    email,
    // Form validation helpers
    formErrors,
    isFieldRequired,
    getErrorText,
    getOptions,
    scrollToError,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useVerificationStore, import.meta.hot));
}
