<script setup lang="ts">
// @ts-nocheck
import { storeToRefs } from 'pinia';
import { VFormGroup } from '@global-torque/ui-kit/form';
import { VFormInput } from '@global-torque/ui-kit/form';
import { VFormInputPassword } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { VFormCheckbox } from '@global-torque/ui-kit/form';
import { FormCol, FormRow } from '@global-torque/ui-kit/form';
import { getAuthLinks } from '../links.ts';
import { useSignupStore } from '../store/useSignup.ts';
import {
  nextTick, onMounted, onUnmounted, ref, watch,
} from 'vue';
import { useGlobalLoader } from '@global-torque/invest-runtime/loader';
import VAuthDemoAccountButton from './VAuthDemoAccountButton.vue';
import { ToggleGroup, ToggleGroupItem } from '@global-torque/ui-primitives/toggle-group';
import { Spinner } from '@global-torque/ui-primitives/spinner';
import { Check, Eye, EyeOff } from '@lucide/vue';
import { EyeIcon, EyeOffIcon } from '@global-torque/invest-widgets/icons';
import CheckIcon from '@global-torque/invest-widgets/icons/images/check.svg?component';

const signupStore = useSignupStore();
const {
  terms: urlTerms,
  privacy: urlPrivacy,
  blog: urlBlog,
} = getAuthLinks();
const {
  isLoading, model, isDisabledButton,
  setSignupState, queryFlow, checkbox,
  isDemoAccountAvailable, isDemoAccountLoading,
  signupStep, selectedProfileType, continuationError,
  invitationEntry, invitationPreview, verifiedSessionEmail, isEmailFixed, isInvitationContinuation,
  isInvitationContinuationPending,
} = storeToRefs(signupStore);

const profileOptions = [
  { value: 'individual', label: 'Individual', description: 'Invest in your own name.' },
  { value: 'entity', label: 'Entity', description: 'Invest through a company or organization.' },
  { value: 'trust', label: 'Trust', description: 'Invest through a trust.' },
] as const;

const globalLoader = useGlobalLoader();
const { isLoading: isGlobalLoading } = storeToRefs(globalLoader);
const isAuthLoading = ref(false);
const invitationHeading = ref<HTMLElement | null>(null);

const onLogin = () => {
  signupStore.onLogin();
};

const isDisabled = (
  field: 'first_name' | 'last_name' | 'email',
) => (
  (field === 'email' && isEmailFixed.value)
  || Boolean(queryFlow.value && model.value[field]?.length > 1)
);

const signupHandler = async () => {
  signupStore.signupPasswordHandler();
};

const demoAccountHandler = async () => {
  signupStore.demoAccountHandler();
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
  signupStore.onMountedHandler();
  syncAuthLoading(isGlobalLoading.value);
});

onUnmounted(() => {
  signupStore.disposeInvitationEntry();
});

watch(isGlobalLoading, (active) => {
  syncAuthLoading(active);
});

watch(
  () => invitationEntry.value.status,
  async (status, previous) => {
    if (status !== previous && !['direct', 'anonymous'].includes(status)) {
      await nextTick();
      invitationHeading.value?.focus();
    }
  },
);
</script>

<template>
  <section
    v-if="invitationEntry.status === 'checking'"
    class="signup-invitation-state"
    aria-busy="true"
    aria-live="polite"
    data-testid="invitation-loading"
  >
    <h1 ref="invitationHeading" tabindex="-1">Checking your invitation…</h1>
    <p>We’re verifying the invitation and your signed-in account.</p>
  </section>
  <section
    v-else-if="invitationEntry.status === 'unavailable'"
    class="signup-invitation-state"
    role="alert"
    data-testid="invitation-unavailable"
  >
    <h1 ref="invitationHeading" tabindex="-1">This invitation is unavailable</h1>
    <p>It may have expired, been cancelled, or already been accepted.</p>
    <Button
      type="button"
      @click="signupStore.returnHome"
      size="lg"
    >
      Return home
    </Button>
  </section>
  <section
    v-else-if="invitationEntry.status === 'session-error'"
    class="signup-invitation-state"
    role="alert"
    data-testid="invitation-session-error"
  >
    <h1 ref="invitationHeading" tabindex="-1">We could not verify your account</h1>
    <p>{{ invitationEntry.message }}</p>
    <Button type="button" @click="signupStore.retryInvitationVerification()" size="lg">
      Try again
    </Button>
  </section>
  <form
    v-else-if="['match', 'accepting'].includes(invitationEntry.status)"
    class="signup-invitation-state"
    :aria-busy="invitationEntry.status === 'accepting'"
    data-testid="invitation-match"
    @submit.prevent="signupStore.acceptCurrentInvitation"
  >
    <h1 ref="invitationHeading" tabindex="-1">
      {{ invitationPreview?.kind === 'team' ? 'Accept team invitation' : 'Accept invitation' }}
    </h1>
    <p>This invitation was sent to <strong>{{ invitationPreview?.email }}</strong>.</p>
    <p>You are signed in as <strong>{{ verifiedSessionEmail }}</strong>.</p>
    <p v-if="invitationPreview?.kind === 'team'">
      Accepting may update your existing fund-manager access to the role assigned by the inviter.
    </p>
    <p v-else-if="invitationPreview?.profileType">
      Investment profile type: {{ invitationPreview.profileType }}.
    </p>
    <p v-if="invitationEntry.status === 'accepting'" aria-live="polite">Accepting invitation…</p>
    <div class="signup-invitation-state__actions">
      <Button
        type="submit"
        :disabled="invitationEntry.status === 'accepting' || invitationEntry.status === 'accepting'"
        size="lg"
      >
          <Spinner v-if="invitationEntry.status === 'accepting'" />
        Accept invitation
      </Button>
      <Button
        type="button"
        :disabled="invitationEntry.status === 'accepting'"
        @click="signupStore.goToDashboard"
        variant="link"
      >
          <Spinner v-if="invitationEntry.status === 'accepting'" />
        Back to Dashboard
      </Button>
    </div>
  </form>
  <section
    v-else-if="['mismatch', 'logging-out'].includes(invitationEntry.status)"
    class="signup-invitation-state"
    :aria-busy="invitationEntry.status === 'logging-out'"
    data-testid="invitation-mismatch"
  >
    <h1 ref="invitationHeading" tabindex="-1">Use the invited account</h1>
    <p>This invitation was sent to <strong>{{ invitationPreview?.email }}</strong>.</p>
    <p>You are signed in with a different account.</p>
    <p v-if="invitationEntry.status === 'logging-out'" aria-live="polite">Logging out…</p>
    <div class="signup-invitation-state__actions">
      <Button
        type="button"
        :disabled="invitationEntry.status === 'logging-out' || invitationEntry.status === 'logging-out'"
        @click="signupStore.logoutForCurrentInvitation"
        size="lg"
      >
          <Spinner v-if="invitationEntry.status === 'logging-out'" />
        Log out
      </Button>
      <Button
        type="button"
        :disabled="invitationEntry.status === 'logging-out'"
        @click="signupStore.goToDashboard"
        variant="link"
      >
          <Spinner v-if="invitationEntry.status === 'logging-out'" />
        Back to Dashboard
      </Button>
    </div>
  </section>
  <section
    v-else-if="invitationEntry.status === 'accept-error'"
    class="signup-invitation-state"
    role="alert"
    data-testid="invitation-accept-error"
  >
    <h1 ref="invitationHeading" tabindex="-1">Invitation could not be accepted</h1>
    <p>{{ invitationEntry.message }}</p>
    <Button
      v-if="invitationEntry.retryable"
      type="button"
      @click="signupStore.acceptCurrentInvitation"
      size="lg"
    >
      Try again
    </Button>
    <Button type="button" @click="signupStore.goToDashboard" variant="link">
      Back to Dashboard
    </Button>
  </section>
  <section
    v-else-if="invitationEntry.status === 'accepted-navigation-failed'"
    class="signup-invitation-state"
    role="alert"
    data-testid="invitation-navigation-error"
  >
    <h1 ref="invitationHeading" tabindex="-1">Invitation accepted</h1>
    <p>{{ invitationEntry.message }}</p>
    <Button type="button" @click="signupStore.acceptCurrentInvitation" size="lg">
      Continue
    </Button>
  </section>
  <!--
    The form also covers the instant between account creation and an
    invitation's redirect. Swapping in a progress panel there flashed a block
    nobody could finish reading, which read as breakage; leaving the form in
    place means the page simply does not change until it navigates.
  -->
  <form
    v-else-if="(invitationEntry.status === 'direct' || invitationEntry.status === 'anonymous') && (signupStep === 'registration' || isInvitationContinuationPending)"
    class="VFormAuthSignup signup-form"
    :class="{ 'is--auth-loading': isAuthLoading }"
    novalidate
    @submit.prevent="signupHandler"
  >
    <div class="signup-form__wrap">
      <FormRow>
        <FormCol col2>
          <VFormGroup
            v-slot="VFormGroupProps"
            :required="signupStore.isFieldRequired('first_name')"
            :error-text="signupStore.getErrorText('first_name', setSignupState.error?.data?.responseJson)"
            label="First Name"
            data-testid="first-name-group"
          >
            <VFormInput
              :model-value="model.first_name"
              :is-error="VFormGroupProps.isFieldError"
              placeholder="First Name"
              name="first-name"
              size="large"
              :disabled="isDisabled('first_name')"
              data-testid="first-name"
              class="signup-form__input"
              @update:model-value="model.first_name = $event.trim()"
            />
          </VFormGroup>
        </FormCol>
        <FormCol col2>
          <VFormGroup
            v-slot="VFormGroupProps"
            :required="signupStore.isFieldRequired('last_name')"
            :error-text="signupStore.getErrorText('last_name', setSignupState.error?.data?.responseJson)"
            label="Last Name"
            data-testid="last-name-group"
          >
            <VFormInput
              :model-value="model.last_name"
              :is-error="VFormGroupProps.isFieldError"
              placeholder="Last Name"
              name="last-name"
              data-testid="last-name"
              size="large"
              :disabled="isDisabled('last_name')"
              class="signup-form__input"
              @update:model-value="model.last_name = $event.trim()"
            />
          </VFormGroup>
        </FormCol>
      </FormRow>

      <div class="signup-form__input-wrap">
        <VFormGroup
          v-slot="VFormGroupProps"
          :required="signupStore.isFieldRequired('email')"
          :error-text="signupStore.getErrorText('email', setSignupState.error?.data?.responseJson)"
          label="Email Address"
          data-testid="email-group"
        >
          <VFormInput
            :model-value="model.email"
            :is-error="VFormGroupProps.isFieldError"
            placeholder="Enter Address"
            name="email"
            size="large"
            data-testid="email"
            :disabled="isDisabled('email')"
            type="email"
            class="signup-form__input"
            @update:model-value="model.email = $event.trim()"
          />
        </VFormGroup>
      </div>

      <div class="signup-form__input-wrap">
        <VFormGroup
          v-slot="VFormGroupProps"
          :required="signupStore.isFieldRequired('create_password')"
          :error-text="signupStore.getErrorText('create_password', setSignupState.error?.data?.responseJson)"
          label="Create Password"
          data-testid="create-password-group"
        >
          <VFormInputPassword
            :model-value="model.create_password"
            :is-error="VFormGroupProps.isFieldError"
            placeholder="Create Password"
            name="createPassword"
            size="large"
            :show-strength="true"
            :reveal-tabbable="false"
            data-testid="create-password"
            class="signup-form__input"
            @update:model-value="model.create_password = $event.trim()"
          >
            <template #visibility-icon="{ visible }">
              <component
                :is="visible ? Eye : EyeOff"
                class="signup-form__password-icon-outline size-4"
                aria-hidden="true"
              />
              <component
                :is="visible ? EyeIcon : EyeOffIcon"
                class="signup-form__password-icon-filled"
                aria-hidden="true"
              />
            </template>
          </VFormInputPassword>
        </VFormGroup>
      </div>

      <div class="signup-form__input-wrap">
        <VFormGroup
          v-slot="VFormGroupProps"
          :required="signupStore.isFieldRequired('repeat_password')"
          :error-text="signupStore.getErrorText('repeat_password', setSignupState.error?.data?.responseJson)"
          label="Confirm Password"
          data-testid="repeat-password-group"
        >
          <VFormInputPassword
            :model-value="model.repeat_password"
            :is-error="VFormGroupProps.isFieldError"
            placeholder="Confirm Password"
            name="repeatPassword"
            size="large"
            :reveal-tabbable="false"
            data-testid="repeat-password"
            class="signup-form__input"
            @update:model-value="model.repeat_password = $event.trim()"
          >
            <template #visibility-icon="{ visible }">
              <component
                :is="visible ? Eye : EyeOff"
                class="signup-form__password-icon-outline size-4"
                aria-hidden="true"
              />
              <component
                :is="visible ? EyeIcon : EyeOffIcon"
                class="signup-form__password-icon-filled"
                aria-hidden="true"
              />
            </template>
          </VFormInputPassword>
        </VFormGroup>
      </div>

      <VFormCheckbox
        v-model="checkbox"
        data-testid="V-checkbox"
        class="signup-form__checkbox"
      >
        <template #indicator>
          <Check class="signup-form__checkbox-icon-outline size-3.5" aria-hidden="true" />
          <CheckIcon class="signup-form__checkbox-icon-filled size-3.5" aria-hidden="true" />
        </template>
        <div class="signup-form__checkbox-text is--small">
          I agree with
          <a
            :href="urlTerms"
            target="_blank"
            rel="noopener noreferrer"
            class="is--link-2"
          >
            terms of use
          </a>
          and
          <a
            :href="urlPrivacy"
            target="_blank"
            rel="noopener noreferrer"
            class="is--link-2"
          >
            privacy policy
          </a>
          and I consent to the electronic delivery of all information
          pertaining to my use of this platform including, but not limited to,
          <a
            :href="urlBlog"
            target="_blank"
            rel="noopener noreferrer"
            class="is--link-2"
          >
            educational materials
          </a>,
          notices, and transaction confirmations.
        </div>
      </VFormCheckbox>

      <Button
        type="submit"
        :disabled="isDisabledButton || isInvitationContinuationPending || isLoading || isInvitationContinuationPending"
        data-testid="button"
        class="signup-form__btn w-full"
        size="lg"
      >
          <Spinner v-if="isLoading || isInvitationContinuationPending" />
        Sign Up
      </Button>

      <VAuthDemoAccountButton
        :visible="isDemoAccountAvailable"
        :loading="isDemoAccountLoading"
        :disabled="isLoading"
        @click="demoAccountHandler"
      />

      <div
        v-if="!queryFlow"
        class="signup-form__login-wrap  is--no-margin"
      >
        <span class="signup-form__login-label is--body">
          Already have an account?
        </span>

        <Button
          as="a"
          :href="signupStore.signInHref"
          class="signup-form__login-btn"
          @click.prevent="onLogin"
          variant="link"
          size="lg"
        >
          Log In
        </Button>
      </div>
    </div>
  </form>
  <!--
    An invitation fixes the profile type, so the chooser must never render on
    this path. Only a failure is worth its own screen: it is the one state the
    investor has to read and act on.
  -->
  <section
    v-else-if="isInvitationContinuation"
    class="signup-invitation-state"
    role="alert"
    data-testid="invitation-continuation-error"
  >
    <h2>We could not finish your registration</h2>
    <p>{{ continuationError }}</p>
    <Button
      type="button"
      @click="signupStore.retryProfileContinuation"
      size="lg"
    >
      Try again
    </Button>
  </section>
  <section v-else class="signup-profile-choice" aria-labelledby="signup-profile-choice-title">
    <h1
      id="signup-profile-choice-title"
      class="signup-profile-choice__title"
    >
      Who are you investing as?
    </h1>
    <p class="signup-profile-choice__description">
      Your account is created. Choose the investment profile you want to set up.
    </p>
    <p class="text-sm font-medium">
      Investment profile type
    </p>
    <ToggleGroup
      v-model="selectedProfileType"
      type="single"
      variant="outline"
      aria-label="Investment profile type"
      :disabled="signupStep === 'resolving'"
      class="flex-wrap justify-start"
    >
      <ToggleGroupItem
        v-for="option in profileOptions"
        :key="option.value"
        :value="option.value"
        class="h-auto flex-col items-start px-4 py-3 text-left"
      >
        <strong>{{ option.label }}</strong>
        <span class="text-xs text-muted-foreground">{{ option.description }}</span>
      </ToggleGroupItem>
    </ToggleGroup>
    <p v-if="continuationError" role="alert">{{ continuationError }}</p>
    <div class="signup-profile-choice__actions">
      <Button
        v-if="signupStep !== 'error'"
        type="button"
        :disabled="!selectedProfileType || signupStep === 'resolving' || signupStep === 'resolving'"
        class="signup-profile-choice__continue"
        @click="signupStore.continueWithProfileType"
        size="lg"
      >
          <Spinner v-if="signupStep === 'resolving'" />
        Continue
      </Button>
      <Button v-else type="button" @click="signupStore.retryProfileContinuation" size="lg">
        Try again
      </Button>
    </div>
  </section>
</template>

<style lang="scss">
.signup-form {
  $root: &;

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

  &__signup-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 70px 0;
  }

  &__signup-btn {
    max-width: 139px;
  }

  &__signup-label {
    font-size: 14px;
    line-height: 100%;
    color: var(--ui-color-text-secondary, var(--color-text-strong));
  }

  &__checkbox {
    margin-top: 20px;
  }

  &__checkbox-icon-outline {
    display: var(--ui-checkbox-icon-outline-display, block);
  }

  &__checkbox-icon-filled {
    display: var(--ui-checkbox-icon-filled-display, none);
  }

  &__btn {
    margin-top: 40px;
  }

  &__input-wrap {
    position: relative;

    & + & {
      margin-top: 25px;
    }
  }

  &__input {
    width: 100%;
  }

  &__wrap {
    padding: 40px;
    background: var(--ui-color-surface, var(--background));
    box-shadow: var(--ui-shadow-dialog, var(--shadow-dialog));

    @media screen and (width < 768px){
      padding: 20px;
    }
  }

  &__checkbox-text {
    color: var(--ui-color-text-secondary, var(--color-text-strong));
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

.signup-profile-choice {
  &__title {
    margin-inline: auto;
    margin-bottom: 32px;
    text-align: center;

    @media screen and (width >= 768px){
      white-space: nowrap;
    }
  }

  &__description {
    margin: 0 0 32px;
    text-align: center;
  }

  &__actions {
    display: flex;
    justify-content: center;
    margin-top: 32px;
  }
}

.signup-invitation-state {
  padding: 40px;
  text-align: center;
  background: var(--ui-color-surface, var(--background));
  box-shadow: var(--ui-shadow-dialog, var(--shadow-dialog));

  p {
    margin: 16px 0 24px;
  }
}
</style>
