<script setup lang="ts">
// @ts-nocheck
import { onMounted } from 'vue';
import { useAuthenticatorStore } from '../store/useAuthenticator.ts';
import { useLogoutStore } from '../store/useLogout.ts';
import { VFormGroup } from '@global-torque/ui-kit/form';
import { VFormInput } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { storeToRefs } from 'pinia';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const authenticatorStore = useAuthenticatorStore();
const logoutStore = useLogoutStore();
const {
  model, isDisabledButton,
  isLoading, setLoginState,
} = storeToRefs(authenticatorStore);

onMounted(() => {
  authenticatorStore.onMountedHandler();
});

const totpHandler = () => {
  authenticatorStore.totpHandler();
};
const onLogout = () => {
  logoutStore.logoutHandler();
};
</script>

<template>
  <form
    class="VFormAuthAuthenticator form-auth-authenticator"
    novalidate
    data-testid="form-auth-authenticator"
    @submit.prevent="totpHandler"
  >
    <div class="form-auth-authenticator__wrap">
      <VFormGroup
        v-slot="VFormGroupProps"
        :required="authenticatorStore.isFieldRequired('totp_code')"
        :error-text="authenticatorStore.getErrorText('totp_code', setLoginState.error?.data?.responseJson)"
        label="Authentication Code"
        class="form-auth-authenticator__input"
        data-testid="totp-code-group"
      >
        <VFormInput
          :model-value="model.totp_code"
          :is-error="VFormGroupProps.isFieldError"
          placeholder="Enter Authentication Code"
          name="totp_code"
          size="large"
          type="text"
          data-testid="totp-code"
          @update:model-value="model.totp_code = $event"
        />
      </VFormGroup>
      <Button
        type="submit"
        :disabled="isDisabledButton || isLoading"
        data-testid="button"
        class="form-auth-authenticator__btn w-full"
        size="lg"
      >
          <Spinner v-if="isLoading" />
        Verify
      </Button>

      <div class="form-auth-authenticator__signup-wrap  is--no-margin">
        <span class="form-auth-authenticator__signup-label is--body">
          Something's not working?
        </span>

        <Button
          type="button"
          class="form-auth-authenticator__signup-btn"
          @click.prevent="onLogout"
          variant="link"
          size="lg"
        >
          Log Out
        </Button>
      </div>
    </div>
  </form>
</template>

<style lang="scss">
.form-auth-authenticator {

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
    color: var(--color-text-strong);
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
    background: var(--background);
    box-shadow: var(--shadow-dialog);

    @media screen and (width < 768px){
      padding: 20px;
    }
  }
}
</style>
