<script setup lang="ts">
import { computed } from 'vue';
import { VFormGroup, VFormInputOtp } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { Spinner } from '@global-torque/ui-primitives/spinner';

type WalletAuthOtpFormProps = {
  description?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputHelperText?: string;
  inputTestId?: string;
  isBusy: boolean;
  isOtpStep: boolean;
  mode?: 'page' | 'dialog';
  submitButtonText?: string;
  showSubmit?: boolean;
  showOperationWarning?: boolean;
};

const props = withDefaults(defineProps<WalletAuthOtpFormProps>(), {
  description: '',
  inputLabel: 'Email Verification Code',
  inputPlaceholder: 'Enter email code',
  inputHelperText: 'Enter the 6-digit code we sent to your email.',
  inputTestId: 'wallet-auth-page-otp',
  mode: 'page',
  submitButtonText: 'Continue',
  showSubmit: true,
  showOperationWarning: false,
});

const codeValue = defineModel<string>('codeValue', { required: true });

const emit = defineEmits<{
  submit: [];
}>();

const isCodeStep = computed(() => props.isOtpStep);
const isSubmitDisabled = computed(() => (
  isCodeStep.value && codeValue.value.length !== 6
));
const showCodeField = computed(() => isCodeStep.value);

const handleFormSubmit = () => {
  if (props.isBusy || isSubmitDisabled.value) return;
  emit('submit');
};

const handleComplete = () => {
  if (props.isBusy || isSubmitDisabled.value) return;
  emit('submit');
};
</script>

<template>
  <form
    class="VFormWalletAuthOtp wallet-auth-otp-form"
    novalidate
    data-testid="wallet-auth-otp-form"
    @submit.prevent="handleFormSubmit"
  >
    <div
      class="wallet-auth-otp-form__wrap"
      :class="{ 'wallet-auth-otp-form__wrap--dialog': props.mode === 'dialog' }"
    >
      <p
        v-if="description"
        class="wallet-auth-otp-form__description"
      >
        {{ description }}
      </p>

      <VFormGroup
        v-if="showCodeField"
        v-slot="VFormGroupProps"
        :label="inputLabel"
        :helper-text="inputHelperText"
        required
        class="wallet-auth-otp-form__input"
        data-testid="wallet-auth-otp-group"
      >
        <VFormInputOtp
          v-model="codeValue"
          :is-error="VFormGroupProps.isFieldError"
          :data-testid="inputTestId"
          class="wallet-auth-otp-form__input-otp"
          @complete="handleComplete"
        />
      </VFormGroup>

      <template v-if="showOperationWarning">
        <hr />
        <p class="wallet-auth-operation-summary__text">
          This operation cannot be reversed after it is authorized. Do not enter the
          verification code unless the amount, token, network, and wallet address match
          the action you intended.
        </p>
      </template>

      <Button
        v-if="showSubmit"
        type="submit"
        :disabled="isSubmitDisabled || isBusy"
        class="wallet-auth-otp-form__submit w-full"
        size="lg"
      >
          <Spinner v-if="isBusy" />
        {{ submitButtonText }}
      </Button>
    </div>
  </form>
</template>

<style lang="scss">
.wallet-auth-otp-form {
  &__wrap {
    padding: 40px;
    background: var(--background);
    box-shadow: 0 4px 5px -2px rgb(18 22 31 / 5%), 0 6px 25px 2px rgb(18 22 31 / 6%);

    @media screen and (width < 768px) {
      padding: 20px;
    }
  }

  &__wrap--dialog {
    padding: 0;
    background: transparent;
    box-shadow: none;
  }

  &__description {
    margin: 0 0 16px;
    color: #495057;
  }

  &__submit {
    margin-top: 40px;
  }
}
</style>
