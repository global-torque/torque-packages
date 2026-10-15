<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { VFormGroup } from '@global-torque/ui-kit/form';
import { VFormInputPassword } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { useLoginRefreshStore } from '../store/useLoginRefresh.ts';
import { storeToRefs } from 'pinia';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const loginRefreshStore = useLoginRefreshStore();
const { isLoading, model, isDisabledButton, loginErrorText } = storeToRefs(loginRefreshStore as any) as any;

const formElement = ref<HTMLFormElement | null>(null);

const focusPassword = () => {
  void nextTick(() => {
    formElement.value?.querySelector<HTMLInputElement>('input[type="password"]')?.focus();
  });
};

const loginHandler = () => loginRefreshStore.loginPasswordHandler();

onMounted(focusPassword);
defineExpose({ focusPassword });
</script>

<template>
  <form class="VFormAuthLogInRefresh v-form-auth-login-refresh" novalidate data-testid="v-form-auth-login-refresh" ref="formElement" @submit.prevent="loginHandler">
    <VFormGroup
      v-slot="VFormGroupProps"
      :required="loginRefreshStore.isFieldRequired('password')"
      :error-text="loginErrorText"
      label="Password"
      data-testid="password-group"
    >
      <VFormInputPassword
        :model-value="model.password"
        :is-error="VFormGroupProps.isFieldError"
        placeholder="Password"
        name="password"
        autocomplete="current-password"
        size="large"
        :reveal-tabbable="false"
        data-testid="password"
        @update:model-value="model.password = $event"
      />
    </VFormGroup>

    <Button type="submit" :disabled="isDisabledButton || isLoading" data-testid="confirm" class="w-full" size="lg">
      <Spinner v-if="isLoading" />
      Confirm
    </Button>
  </form>
</template>

<style lang="scss">
.v-form-auth-login-refresh {
  display: grid;
  gap: 24px;
}
</style>
