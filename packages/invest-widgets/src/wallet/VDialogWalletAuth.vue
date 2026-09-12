<script setup lang="ts">
import { computed } from 'vue';
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@global-torque/ui-primitives/dialog';
import { VQueryDialog } from '@global-torque/ui-kit/query-dialog';
import { Button } from '@global-torque/ui-primitives/button';
import { Alert, AlertDescription, AlertTitle } from '@global-torque/ui-primitives/alert';
import VWalletAuthOperationSummary from './VWalletAuthOperationSummary.vue';
import VFormWalletAuthOtp from './VFormWalletAuthOtp.vue';
import { useVDialogWalletAuth } from './useVDialogWalletAuth.ts';
import { Spinner } from '@global-torque/ui-primitives/spinner';
import { TriangleAlertIcon } from '@lucide/vue';

const open = defineModel<boolean>('open');

const {
  codeValue,
  isBusy,
  isCodeStep,
  isOtpStep,
  isSuccessStep,
  dialogTitle,
  operationIntent,
  operationSummaryScanBaseUrl,
  stepDescription,
  inputLabel,
  inputPlaceholder,
  inputHelperText,
  primaryButtonText,
  isPrimaryDisabled,
  closeDialog,
  handlePrimaryClick,
} = useVDialogWalletAuth({
  open,
});

const shouldShowOperationCodeAlert = computed(() =>
  isCodeStep.value && Boolean(operationIntent.value)
);

const otpFormDescription = computed(() =>
  shouldShowOperationCodeAlert.value ? '' : stepDescription.value
);

const otpSubmitButtonText = computed(() =>
  shouldShowOperationCodeAlert.value ? 'Confirm' : primaryButtonText.value
);
</script>

<template>
  <VQueryDialog
    v-model:open="open"
    query-key="popup"
    query-value="wallet-auth"
  >
    <DialogContent
      :aria-describedby="undefined"
      class="v-dialog-wallet-auth"
    >
      <DialogHeader>
        <DialogTitle>
          {{ dialogTitle }}
        </DialogTitle>
      </DialogHeader>

      <div class="v-dialog-wallet-auth__body is--margin-top-20">
        <Alert
          v-if="shouldShowOperationCodeAlert"
          variant="warning"
          class="v-dialog-wallet-auth__operation-alert">
          <TriangleAlertIcon />
          <AlertTitle>Operation cannot be reversed</AlertTitle>
          <AlertDescription><p class="v-dialog-wallet-auth__alert-text">
              Enter the code only if these details match the operation you intended.
            </p></AlertDescription>
        </Alert>

        <VWalletAuthOperationSummary
          v-if="isCodeStep && operationIntent"
          :intent="operationIntent"
          :scan-base-url="operationSummaryScanBaseUrl"
        />

        <VFormWalletAuthOtp
          v-if="isCodeStep"
          v-model:code-value="codeValue"
          :description="otpFormDescription"
          :input-label="inputLabel"
          :input-placeholder="inputPlaceholder"
          :input-helper-text="inputHelperText"
          input-test-id="wallet-auth-otp"
          :submit-button-text="otpSubmitButtonText"
          :is-busy="isBusy"
          :is-otp-step="isOtpStep"
          mode="dialog"
          @submit="handlePrimaryClick"
        />

        <p
          v-else
          class="v-dialog-wallet-auth__description"
        >
          {{ stepDescription }}
        </p>
      </div>

      <DialogFooter class="v-dialog-wallet-auth__footer">
        <Button
          @click="closeDialog"
          variant="outline"
        >
          {{ isSuccessStep ? 'Close' : 'Cancel' }}
        </Button>
        <Button
          v-if="!isCodeStep"
          :disabled="isPrimaryDisabled || isBusy"
          @click="handlePrimaryClick"
        >
            <Spinner v-if="isBusy" />
          {{ primaryButtonText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </VQueryDialog>
</template>

<style lang="scss">
.v-dialog-wallet-auth {
  width: min(760px, calc(100vw - 48px));
  max-width: 760px;

  &__body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__description {
    margin: 0;
    color: #495057;
  }

  &__operation-alert {
    width: 100%;
    margin: 0;
  }

  &__alert-text {
    margin: 0;

    & + & {
      margin-top: 6px;
    }
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }

  @media screen and (max-width: 768px) {
    width: 100%;
    max-width: 100%;
  }
}
</style>
