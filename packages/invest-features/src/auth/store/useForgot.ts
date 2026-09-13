// @ts-nocheck
import {
  computed, nextTick, ref, toRaw,
} from 'vue';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { navigateWithQueryParams } from '@global-torque/invest-runtime/navigation';
import { getAuthLinks } from '../links.ts';
import { useRepositoryAuth } from '../data/auth.repository.ts';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { JSONSchemaType } from 'ajv/dist/types/json-schema';
import { composeInvestmentFormSchema, createInvestmentAjv, emailRule, errorMessageRule, prepareInvestmentFormData } from '@global-torque/invest-core/form-validation';
import { SELFSERVICE } from '@global-torque/domain-types/authConstants';
import { oryErrorHandling } from '@global-torque/invest-runtime/error/oryErrorHandling';
import { oryResponseHandling } from '@global-torque/invest-runtime/error/oryResponseHandling';

type FormModelForgot = {
  email: string;
}


export const useForgotStore = defineStore('forgot', () => {
  const { checkEmail: urlCheckEmail } = getAuthLinks();
  const authRepository = useRepositoryAuth();
  const { getSchemaState, setRecoveryState, getAuthFlowState } = storeToRefs(authRepository);

  const resetRecoveryFlow = () => {
    void authRepository
      .getAuthFlow(SELFSERVICE.recovery)
      .then((flow) => oryResponseHandling(flow as any));
  };

  // Form schema and validation
  const schemaFrontend = computed(() => ({
    $schema: 'http://json-schema.org/draft-07/schema#',
    definitions: {
      Auth: {
        properties: {
          email: emailRule,
        },
        type: 'object',
        required: ['email'],
        errorMessage: errorMessageRule,
      },
    },
    $ref: '#/definitions/Auth',
  } as unknown as JSONSchemaType<FormModelForgot>));

  const schemaBackend = computed(() => (
    getSchemaState.value.data ? structuredClone(toRaw(getSchemaState.value.data)) : null));

  const fieldsPaths = ['email'];

  const {
    model, validation, isValid, onValidate,
    scrollToError, formErrors, isFieldRequired, getErrorText,
    getOptions,
  } = useFormValidation<FormModelForgot>(
    schemaFrontend,
    schemaBackend,
    {} as FormModelForgot,
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
      nextTick(() => scrollToError('VFormAuthForgot'));
      return false;
    }
    return true;
  };

  const recoveryHandler = async () => {
    if (!validateForm()) return;

    isLoading.value = true;
    try {
      const flowData = await authRepository.getAuthFlow(SELFSERVICE.recovery);
      oryResponseHandling(flowData);
      if (getAuthFlowState.value.error) {
        isLoading.value = false;
        return;
      }

      await authRepository.setRecovery(authRepository.flowId.value, {
        email: model.email,
        method: 'code',
        csrf_token: authRepository.csrfToken.value,
      });

      if (setRecoveryState.value.error) {
        isLoading.value = false;
        return;
      }

      if (setRecoveryState.value.data.state === 'sent_email') {
        navigateWithQueryParams(urlCheckEmail, { email: model.email, flowId: authRepository.flowId.value });
      }
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
    isLoading,
    model,
    validation,
    schemaBackend,
    schemaFrontend,
    isDisabledButton,
    setRecoveryState,
    onValidate,
    isValid,
    recoveryHandler,
    // Form validation helpers
    formErrors,
    isFieldRequired,
    getErrorText,
    getOptions,
    scrollToError,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useForgotStore, import.meta.hot));
}
