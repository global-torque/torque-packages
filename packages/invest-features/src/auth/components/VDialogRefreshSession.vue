<script setup lang="ts">
// @ts-nocheck
import { onUnmounted, watch } from 'vue';
import { DialogContent } from '@global-torque/ui-primitives/dialog';
import { VQueryDialog } from '@global-torque/ui-kit/query-dialog';
import type { AuthSocialIcons } from './VFormAuthSocial.vue';
import VFormAuthLogInRefresh from './VFormAuthLogInRefresh.vue';
import { useLoginRefreshStore } from '../store/useLoginRefresh.ts';
import { useDialogs } from '@global-torque/invest-runtime/dialogs';

const loginRefreshStore = useLoginRefreshStore();
const dialogsStore = useDialogs();

const open = defineModel<boolean>();
defineProps<{
  socialIcons: AuthSocialIcons;
}>();

watch(
  open,
  (isOpen, wasOpen) => {
    if (isOpen !== wasOpen) {
      loginRefreshStore.resetForm();
    }
    if (!isOpen) {
      dialogsStore.completeSessionRefresh(false);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  loginRefreshStore.resetForm();
  dialogsStore.completeSessionRefresh(false);
});
</script>

<template>
  <VQueryDialog v-model:open="open" query-key="popup" query-value="security-check">
    <DialogContent :aria-describedby="undefined" class="VDialogRefreshSession v-dialog-refresh-session">
      <div class="v-dialog-refresh-session__header">
        <h2>Security Check</h2>
        <p class="is--color-black">Before this action we need to verify your identity. Confirm with your existing password.</p>
      </div>

      <div class="v-dialog-refresh-session__identity">
        <span class="v-dialog-refresh-session__identity-label">Email Address</span>
        <span class="v-dialog-refresh-session__identity-value" data-testid="session-email">
          {{ loginRefreshStore.sessionEmail }}
        </span>
      </div>

      <VFormAuthLogInRefresh />
    </DialogContent>
  </VQueryDialog>
</template>

<style lang="scss">
.v-dialog-refresh-session {
  z-index: 1101;
  gap: 24px;

  &__header {
    display: grid;
    gap: 12px;
  }

  &__identity {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__identity-label {
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }

  &__identity-value {
    overflow-wrap: anywhere;
    font-weight: 600;
  }
}
</style>
