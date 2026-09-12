<script setup lang="ts">
import { VFormGroup } from '@global-torque/ui-kit/form';
import { VFormInput } from '@global-torque/ui-kit/form';
import { VFormInputPassword } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { useLoginRefreshStore } from '../store/useLoginRefresh.ts';
import { storeToRefs } from 'pinia';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const emit = defineEmits(['cancel']);

const loginRefreshStore = useLoginRefreshStore();
const {
  isLoading, model, isDisabledButton,
  setLoginState,
} = storeToRefs(loginRefreshStore as any) as any;

const loginHandler = async () => {
  loginRefreshStore.loginPasswordHandler();
};
</script>

<template>
  <form
    class="VFormAuthLogInRefresh v-form-auth-login-refresh"
    novalidate
    data-testid="v-form-auth-login-refresh"
    @submit.prevent="loginHandler"
  >
    <div class="v-form-auth-login-refresh__wrap">
      <VFormGroup
        v-slot="VFormGroupProps"
        :required="loginRefreshStore.isFieldRequired('email')"
        :error-text="loginRefreshStore.getErrorText('email', setLoginState.error?.data?.responseJson)"
        label="Email Address"
        class="v-form-auth-login-refresh__input"
        data-testid="email-group"
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
      <VFormGroup
        v-slot="VFormGroupProps"
        :required="loginRefreshStore.isFieldRequired('password')"
        :error-text="loginRefreshStore.getErrorText('password', setLoginState.error?.data?.responseJson)"
        label="Password"
        class="v-form-auth-login-refresh__input"
        data-testid="password-group"
      >
        <VFormInputPassword
          :model-value="model.password"
          :is-error="VFormGroupProps.isFieldError"
          placeholder="Password"
          name="password"
          size="large"
          :reveal-tabbable="false"
          data-testid="password"
          @update:model-value="model.password = $event"
        />
      </VFormGroup>

      <Button
        type="submit"
        :disabled="isDisabledButton || isLoading"
        data-testid="signup"
        class="v-form-auth-login-refresh__btn w-full"
        size="lg"
      >
          <Spinner v-if="isLoading" />
        Log In
      </Button>

      <Button
        type="button"
        class="is--margin-top-12 w-full"
        @click.stop.prevent="emit('cancel')"
        variant="link"
        size="lg"
      >
        Cancel
      </Button>
    </div>
  </form>
</template>

<style lang="scss">
.v-form-auth-login-refresh {
  &__forgot {
    margin-top: 4px;
    display: block;
  }

  &__signup-wrap {
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

  &__signup-label {
    color: #343A40;
  }

  &__signup-btn {
    @media screen and (width < 768px){
      width: 100%;
    }
  }

  &__btn {
    margin-top: 40px;
  }

  &__input {
    & + & {
      margin-top: 20px;
    }
  }

  &__input-icon {
    color: #495057;
    width: 20px;
    height: 20px;
    display: flex;
  }

  &__wrap {
    padding: 40px;
    background: var(--background);
    box-shadow: 0 4px 5px -2px rgb(18 22 31 / 5%), 0 6px 25px 2px rgb(18 22 31 / 6%);

    @media screen and (width < 768px){
      padding: 20px;
    }
  }
}
</style>
