<script setup lang="ts">
import type { Component } from 'vue';
import type { ContactSubjectPosition, ContactUsSessionPrefill, ContactUsSubmit } from './useContactUsForm';
import { useDialogs } from '@webdevelop-pro/invest-runtime/dialogs';
import { storeToRefs } from 'pinia';

const props = withDefaults(defineProps<{
  dialogLogout?: Component;
  dialogRefreshSession?: Component;
  dialogContactUs?: Component;
  submitContact?: ContactUsSubmit;
  contactSessionPrefill?: ContactUsSessionPrefill;
  contactSubjectPosition?: ContactSubjectPosition;
  dialogWalletAuth?: Component;
}>(), { contactSubjectPosition: 'popper' });

const useDialogsStore = useDialogs();
const {
  isDialogLogoutOpen,
  isDialogRefreshSessionOpen,
  isDialogContactUsOpen,
  isDialogWalletAuthOpen,
  dialogContactUsSubject,
} = storeToRefs(useDialogsStore as any) as any;
</script>

<template>
  <div class="v-dialogs">
    <div
      id="alchemy-signer-iframe-container"
      class="v-dialogs__wallet-auth-iframe"
    />
    <component
      :is="dialogLogout"
      v-if="dialogLogout"
      v-model="isDialogLogoutOpen"
    />
    <component
      :is="dialogRefreshSession"
      v-if="dialogRefreshSession"
      v-model="isDialogRefreshSessionOpen"
    />
    <component
      :is="dialogContactUs"
      v-if="dialogContactUs && submitContact"
      v-model:open="isDialogContactUsOpen"
      :subject="dialogContactUsSubject ?? undefined"
      :submit-contact="submitContact"
      :session-prefill="contactSessionPrefill"
      :subject-position="props.contactSubjectPosition"
    />
    <component
      :is="dialogWalletAuth"
      v-if="dialogWalletAuth"
      v-model:open="isDialogWalletAuthOpen"
    />
  </div>
</template>

<style lang="scss" scoped>
.v-dialogs {
  &__wallet-auth-iframe {
    width: 0;
    height: 0;
    overflow: hidden;
  }
}
</style>
