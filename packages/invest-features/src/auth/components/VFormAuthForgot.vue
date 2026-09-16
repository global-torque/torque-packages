<script setup lang="ts">
import { getAuthLinks } from '../links.ts';
import { useForgotStore } from '../store/useForgot.ts';
import { VFormGroup } from '@global-torque/ui-kit/form';
import { VFormInput } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { storeToRefs } from 'pinia';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const { signin: urlSignin } = getAuthLinks();
const forgotStore = useForgotStore();
const {
  model, isDisabledButton, setRecoveryState,
  isLoading,
} = storeToRefs(forgotStore as any) as any;

const onSubmit = () => {
  forgotStore.recoveryHandler();
};
</script>

<template>
  <form
    class="VFormAuthForgot forgot-form"
    novalidate
    @submit.prevent="onSubmit()"
  >
    <VFormGroup
      v-slot="VFormGroupProps"
      :required="forgotStore.isFieldRequired('email')"
      :error-text="forgotStore.getErrorText('email', setRecoveryState.error?.data?.responseJson)"
      label="Email Address"
      class="forgot-form__input"
    >
      <VFormInput
        :model-value="model.email"
        :is-error="VFormGroupProps.isFieldError"
        placeholder="Enter Address"
        name="email"
        size="large"
        type="email"
        data-testid="email"
        @update:model-value="model.email = $event"
      />
    </VFormGroup>

    <div class="forgot-form__text is--small">
      Enter your email address and we'll send you a code to reset your password.
    </div>

    <Button
      type="submit"
      data-testid="button"
      :disabled="isDisabledButton || isLoading"
      class="forgot-form__btn w-full"
      size="lg"
    >
        <Spinner v-if="isLoading" />
      Send Code
    </Button>
    <Button
      as="a"
      :href="urlSignin"
      class="forgot-form__signup-btn w-full"
      variant="link"
      size="lg"
    >
      Back to Login
    </Button>
  </form>
</template>

<style lang="scss">
.forgot-form {
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
}
</style>
