<script setup lang="ts">
import { VImage } from '@global-torque/ui-kit/image';
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import { Button } from '@global-torque/ui-primitives/button';
import { storeToRefs } from 'pinia';
import image from '../assets/logout-modal.svg?url';
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@global-torque/ui-primitives/dialog';
import { VQueryDialog } from '@global-torque/ui-kit/query-dialog';
import { computed } from 'vue';
import { useLogoutStore } from '../store/useLogout.ts';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const logoutStore = useLogoutStore();
const { isLoading } = storeToRefs(logoutStore as any) as any;
const open = defineModel<boolean>();

const logoutHandler = async () => {
  await logoutStore.logoutHandler();
  open.value = false;
};
const isStaticSite = computed(() => Boolean(
  useInvestApplicationContext().appConfig.isStaticSite,
));

</script>

<template>
  <VQueryDialog
    v-model:open="open"
    query-key="popup"
    query-value="log-out"
  >
    <DialogContent
      :aria-describedby="undefined"
      class="v-dialog-log-out"
    >
      <div>
        <DialogHeader>
          <DialogTitle>
            Log Out
          </DialogTitle>
        </DialogHeader>
        <div class="v-dialog-log-out__img">
          <VImage
      data-testid="logout-image"
            :src="isStaticSite ? '/images/logout-modal.svg' : image"
            alt=""
          />
        </div>
        <p
          class="v-dialog-log-out__text"
          data-testid="disconnect-modal-text"
        >
          Are you sure you want to log out?
        </p>
      </div>
      <DialogFooter>
        <div class="v-dialog-log-out__footer-btns">
          <Button
            data-testid="cancel-button"
            @click="open = false"
            variant="ghost"
            size="lg"
          >
            Cancel
          </Button>
          <Button
            data-testid="logout-button"
            :disabled="isLoading || isLoading"
            @click="logoutHandler"
            variant="destructive"
            size="lg"
          >
              <Spinner v-if="isLoading" />
            Log Out
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </VQueryDialog>
</template>

<style lang="scss">
@use '@global-torque/ui-kit/styles/mixins' as *;
.v-dialog-log-out {
  text-align: center;

    @media screen and (max-width: 768px){
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

  &__img {
    max-width: 190px;
    max-height: 190px;
    margin: 25px auto;

    @include media-lt(tablet) {
      margin-top: 30px;
    }
  }

  &__text {
    margin: 0 0 20px;
    font-size: 17px;
    font-weight: 400;
    word-spacing: 0;

    @include media-lt(tablet) {
      width: 100%;
      max-width: 365px;
      margin: 0 auto 20px;
      line-height: 26px;
    }
  }

  &__footer-btns {
    display: flex;
    justify-content: space-between;
    gap: 20px;

    @include media-lt(tablet) {
      flex-direction: column-reverse;
      align-items: stretch;
      justify-content: flex-start;
    }

    [data-slot='button'] {
      flex-grow: 1;
    }
  }
}
</style>
