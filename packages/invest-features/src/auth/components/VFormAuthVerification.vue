<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useVerificationStore } from '../store/useVerification.ts';
import { VFormGroup } from '@global-torque/ui-kit/form';
import { VFormInput } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { getAuthLinks } from '../links.ts';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const verificationStore = useVerificationStore();
const { forgot: urlForgot } = getAuthLinks();
const {
  model, isLoading, isDisabledButton,
  setRecoveryState,
} = storeToRefs(verificationStore as any) as any;

const verificationHandler = async () => {
  verificationStore.verificationHandler();
};
</script>

<template>
  <form
    class="VFormAuthVerification verification-form"
    novalidate
    @submit.prevent="verificationHandler()"
  >
    <VFormGroup
      v-slot="VFormGroupProps"
      :required="verificationStore.isFieldRequired('code')"
      :error-text="verificationStore.getErrorText('code', setRecoveryState.error?.data?.responseJson)"
      label="Verification Code"
      class="verification-form__input"
      data-testid="code-group"
    >
      <VFormInput
        :model-value="model.code"
        :is-error="VFormGroupProps.isFieldError"
        placeholder="Enter code"
        name="code"
        size="large"
        data-testid="code"
        @update:model-value="model.code = $event"
      />
    </VFormGroup>

    <div class="verification-form__text is--small">
      Enter the verification code we just sent you on your email address
    </div>

    <Button
      type="submit"
      :disabled="isDisabledButton || isLoading"
      class="verification-form__btn w-full"
      size="lg"
    >
        <Spinner v-if="isLoading" />
      Verify Code
    </Button>

    <div class="verification-form__login-wrap is--no-margin">
      <span class="verification-form__login-label is--body">
        Didn't receive the email?
      </span>

      <Button
        as="a"
        :href="urlForgot"
        class="verification-form__login-btn"
        variant="link"
        size="lg"
      >
        Resend Code
      </Button>
    </div>
  </form>
</template>

<style lang="scss">
.verification-form {
  padding: 40px;
  background: var(--ui-color-surface, var(--background));
  box-shadow: var(--ui-shadow-dialog, var(--shadow-dialog));

  @media screen and (width < 768px){
      padding: 20px;
  }

  &__text {
    color: var(--ui-color-text-muted, var(--color-text-meta));
    margin-top: 4px;
  }

  &__btn {
    margin-top: 40px;
  }

  &__signup-btn {
    margin-top: 12px;
  }

  &__login-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 12px;
    gap: 12px;

    @media screen and (width < 768px){
      flex-direction: column;
      margin-top: 20px;
    }
  }

  &__login-label {
    color: var(--ui-color-text-secondary, var(--color-text-strong));
  }

  &__login-btn {
    @media screen and (width < 768px){
      width: 100%;
    }
  }
}
</style>
