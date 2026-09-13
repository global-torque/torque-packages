<script setup lang="ts">
import {
  computed, nextTick, reactive,
} from 'vue';
import { Button } from '@global-torque/ui-primitives/button';
import { VFormGroup, VFormInput } from '@global-torque/ui-kit/form';
import { useFormValidation } from '@global-torque/ui-kit/form-validation';
import { composeInvestmentFormSchema, createInvestmentAjv, prepareInvestmentFormData } from '@global-torque/invest-core/form-validation';
import type { JSONSchemaType } from 'ajv/dist/types/json-schema';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const props = withDefaults(defineProps<{
  loading?: boolean;
  label?: string;
}>(), {
  loading: false,
});

const emit = defineEmits<{
  (event: 'submit', email: string): void;
}>();

type FormModelSubscribe = {
  email: string;
}

const schemaSubscribe: JSONSchemaType<FormModelSubscribe> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
  },
  required: ['email'],
  additionalProperties: false,
};

const initialModel: FormModelSubscribe = reactive({
  email: '',
});

const {
  model,
  isValid,
  onValidate,
  scrollToError,
  getErrorText,
  isFieldRequired,
} = useFormValidation<FormModelSubscribe>(
  schemaSubscribe,
  undefined,
  initialModel,
  ['email'],
  {
    createAjv: createInvestmentAjv,
    composeSchema: composeInvestmentFormSchema,
    prepareData: prepareInvestmentFormData,
  },
);

const onSubmit = () => {
  onValidate();
  if (!isValid.value) {
    nextTick(() => scrollToError('v-form-footer-subscribe'));
    return;
  }

  emit('submit', model.email);
};

const isDisabledButton = computed(() => !isValid.value || props.loading);
</script>

<template>
  <div class="VFormFooterSubscribe v-form-footer-subscribe">
    <form
      novalidate
      @submit.prevent="onSubmit"
    >
      <div class="v-form-footer-subscribe__group">
        <VFormGroup
          v-slot="baseFormGroupProps"
          :label="label"
          :error-text="getErrorText('email')"
          :required="isFieldRequired('email')"
          dark
        >
          <div class="v-form-footer-subscribe__control-row">
            <div class="v-form-footer-subscribe__input">
              <VFormInput
                :is-error="baseFormGroupProps.isFieldError"
                :model-value="model.email"
                placeholder="Email Address"
                type="email"
                size="large"
                @update:model-value="model.email = $event"
              />
            </div>
            <Button
              type="submit"
              :disabled="isDisabledButton || loading"
              class="v-form-footer-subscribe__button"
              size="lg"
            >
                <Spinner v-if="loading" />
              Subscribe
            </Button>
          </div>
        </VFormGroup>
      </div>
    </form>
  </div>
</template>

<style lang="scss">
.v-form-footer-subscribe {
  &__group {
    width: 100%;
  }

  &__control-row {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
  }

  &__input {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__button {
    flex: 0 0 auto;
  }
}
</style>
