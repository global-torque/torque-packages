<script setup lang="ts">
import { DialogClose, DialogContent, DialogHeader, DialogTitle } from '@global-torque/ui-primitives/dialog';
import { Button } from '@global-torque/ui-primitives/button';
import { X } from '@lucide/vue';
import { VQueryDialog } from '@global-torque/ui-kit/query-dialog';
import { toast } from '@global-torque/ui-primitives/sonner';
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import VFormContactUs from './VFormContactUs.vue';
import type { ContactSubjectPosition, ContactUsSessionPrefill, ContactUsSubmit } from './useContactUsForm';

const open = defineModel<boolean>('open');
const brand = useInvestApplicationContext().appConfig.brand;
const contactEmail = brand.email!;
const props = withDefaults(defineProps<{
  subject?: string;
  submitContact: ContactUsSubmit;
  sessionPrefill?: ContactUsSessionPrefill;
  subjectPosition?: ContactSubjectPosition;
}>(), { subjectPosition: 'popper' });
function accepted() {
  toast.success('Your message has been submitted.');
  open.value = false;
}
</script>

<template>
  <VQueryDialog
    v-model:open="open"
    query-key="popup"
    query-value="contact-us"
  >
    <DialogContent
      :aria-describedby="undefined"
      :show-close-button="false"
      class="v-dialog-contact-us"
    >
      <DialogHeader><DialogTitle>Contact Us</DialogTitle></DialogHeader>
      <VFormContactUs
        v-if="open"
        :active="open"
        :submit-contact="submitContact"
        :session-prefill="sessionPrefill"
        :subject="subject"
        :subject-position="props.subjectPosition"
        :contact-email="contactEmail"
        surface="dialog"
        @accepted="accepted"
      />
      <DialogClose as-child>
        <Button
          type="button"
          variant="link"
          size="icon-lg"
          aria-label="Close"
          class="v-dialog-contact-us__close absolute ring-offset-background
            focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-hidden focus-visible:ring-2"
        >
          <X
            class="v-dialog-contact-us__close-outline size-[18px]"
            aria-hidden="true"
          />
          <svg
            class="v-dialog-contact-us__close-approved size-[18px]"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </Button>
      </DialogClose>
    </DialogContent>
  </VQueryDialog>
</template>

<style scoped lang="scss">
.v-dialog-contact-us {
  max-height: 90dvh;
  overflow-y: auto;
}

.v-dialog-contact-us__close {
  padding: var(--ui-contact-close-padding, 0);
  border: var(--ui-contact-close-border-width, 0) solid transparent;
  font-size: inherit;
  font-weight: var(--ui-contact-close-weight, inherit);
  line-height: var(--ui-contact-close-line-height, normal);
}

.v-dialog-contact-us__close-outline { display: var(--ui-contact-close-outline-display, block); }

.v-dialog-contact-us__close-approved { display: var(--ui-contact-close-approved-display, none); }
</style>
