<script setup lang="ts">
// @ts-nocheck
import { DialogContent } from '@global-torque/ui-primitives/dialog';
import { VQueryDialog } from '@global-torque/ui-kit/query-dialog';
import VFormAuthSocial from './VFormAuthSocial.vue';
import type { AuthSocialIcons } from './VFormAuthSocial.vue';
import VFormAuthLogInRefresh from './VFormAuthLogInRefresh.vue';
import { Separator } from '@global-torque/ui-primitives/separator';
import { useLoginRefreshStore } from '../store/useLoginRefresh.ts';

const loginRefreshStore = useLoginRefreshStore();

const open = defineModel<boolean>();
const props = defineProps<{
  socialIcons: AuthSocialIcons;
}>();


const onSocialClick = (provider: string) => {
  loginRefreshStore.loginSocialHandler(provider);
};
</script>

<template>
  <VQueryDialog
    v-model:open="open"
    query-key="popup"
    query-value="security-check"
  >
    <DialogContent
      :aria-describedby="undefined"
      class="VDialogRefreshSession v-dialog-refresh-session"
    >
      <h2>
        Security Check
      </h2>
      <p class="is--margin-top-20 is--color-black">
        Before this action we need to verify your identity. Please log in with your existing credentials.
      </p>

      <VFormAuthSocial
        class="is--margin-top-20"
        :social-icons="props.socialIcons"
        @click="onSocialClick($event)"
      />

      <div class="is--margin-top-30 flex items-center gap-4">
        <Separator class="flex-1" />
        <span class="text-sm font-extrabold text-muted-foreground">or</span>
        <Separator class="flex-1" />
      </div>

      <VFormAuthLogInRefresh
        class="is--margin-top-30"
        @cancel="open = false"
      />
    </DialogContent>
  </VQueryDialog>
</template>

<style lang="scss">
.v-dialog-refresh-session {
  z-index: 1101;

  &__cancel {
    float: right;
  }
}
</style>
