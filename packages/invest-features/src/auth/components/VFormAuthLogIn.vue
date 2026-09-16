<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted, ref, watch } from 'vue';
import { VFormGroup } from '@global-torque/ui-kit/form';
import { VFormInput } from '@global-torque/ui-kit/form';
import { VFormInputPassword } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { getAuthLinks } from '../links.ts';
import { useLoginStore } from '../store/useLogin.ts';
import { useGlobalLoader } from '@global-torque/invest-runtime/loader';
import VAuthDemoAccountButton from './VAuthDemoAccountButton.vue';
import { Spinner } from '@global-torque/ui-primitives/spinner';
import { Eye, EyeOff } from '@lucide/vue';
import { EyeIcon, EyeOffIcon } from '@global-torque/invest-widgets/icons';

const loginStore = useLoginStore();
const { forgot: urlForgot, signup: urlSignup } = getAuthLinks();
const {
  isLoading, model, isDisabledButton,
  setLoginState,
  isDemoAccountAvailable, isDemoAccountLoading,
} = storeToRefs(loginStore as any) as any;

const globalLoader = useGlobalLoader();
const { isLoading: isGlobalLoading } = storeToRefs(globalLoader as any) as any;
const isAuthLoading = ref(false);

const onSignup = () => {
  loginStore.onSignup();
};

const loginHandler = async () => {
  loginStore.loginPasswordHandler();
};

const demoAccountHandler = async () => {
  loginStore.demoAccountHandler();
};

const syncAuthLoading = (active: boolean) => {
  isAuthLoading.value = active;
  if (!active || typeof document === 'undefined') {
    return;
  }
  const activeElement = document.activeElement as HTMLElement | null;
  activeElement?.blur?.();
};

onMounted(() => {
  syncAuthLoading(isGlobalLoading.value);
});

watch(isGlobalLoading, (active) => {
  syncAuthLoading(active);
});
</script>

<template>
  <form
    class="LogInForm login-form"
    :class="{ 'is--auth-loading': isAuthLoading }"
    novalidate
    data-testid="login-form"
    @submit.prevent="loginHandler"
  >
    <div class="login-form__wrap">
      <VFormGroup
        v-slot="VFormGroupProps"
        :required="loginStore.isFieldRequired('email')"
        :error-text="loginStore.getErrorText('email', setLoginState.error?.data?.responseJson)"
        label="Email Address"
        class="login-form__input"
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
        :required="loginStore.isFieldRequired('password')"
        :error-text="loginStore.getErrorText('password', setLoginState.error?.data?.responseJson)"
        label="Password"
        class="login-form__input"
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
        >
          <template #visibility-icon="{ visible }">
            <component
              :is="visible ? Eye : EyeOff"
              class="login-form__password-icon-outline size-4"
              aria-hidden="true"
            />
            <component
              :is="visible ? EyeIcon : EyeOffIcon"
              class="login-form__password-icon-filled"
              aria-hidden="true"
            />
          </template>
        </VFormInputPassword>
      </VFormGroup>

      <a
        :href="urlForgot"
        class="login-form__forgot is--link-2"
      >
        Forgot password?
      </a>

      <Button
        type="submit"
        :disabled="isDisabledButton || isLoading"
        data-testid="signup"
        class="login-form__btn w-full"
        size="lg"
      >
          <Spinner v-if="isLoading" />
        Log In
      </Button>

      <VAuthDemoAccountButton
        :visible="isDemoAccountAvailable"
        :loading="isDemoAccountLoading"
        :disabled="isLoading"
        @click="demoAccountHandler"
      />

      <div
        class="login-form__signup-wrap  is--no-margin"
      >
        <span class="login-form__signup-label is--body">
          Don't have an account?
        </span>

        <Button
          as="a"
          :href="urlSignup"
          class="login-form__signup-btn"
          @click.prevent="onSignup"
          variant="link"
          size="lg"
        >
          Sign Up
        </Button>
      </div>
    </div>
  </form>
</template>

<style lang="scss">
.login-form {
  &__password-icon-outline { display: var(--ui-password-outline-icon-display, block); }

  &__password-icon-filled {
    display: var(--ui-password-filled-icon-display, none);
    width: 20px;
    height: 20px;
    color: var(--ui-color-text-secondary, currentColor);
  }

  &.is--auth-loading,
  &.is--auth-loading input,
  &.is--auth-loading textarea {
    caret-color: transparent;
  }

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
    color: var(--ui-color-text-secondary, var(--color-text-strong));
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
    color: var(--color-text-meta);
    width: 20px;
    height: 20px;
    display: flex;
  }

  &__wrap {
    padding: 40px;
    background: var(--ui-color-surface, var(--background));
    box-shadow: var(--ui-shadow-dialog, var(--shadow-dialog));

    @media screen and (width < 768px){
      padding: 20px;
    }
  }
}
</style>
