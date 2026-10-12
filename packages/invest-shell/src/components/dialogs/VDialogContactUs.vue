<script setup lang="ts">
import { DialogContent, DialogHeader, DialogTitle } from '@global-torque/ui-primitives/dialog';
import { VQueryDialog } from '@global-torque/ui-kit/query-dialog';
import { toast } from 'vue-sonner';
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
      class="v-dialog-contact-us max-h-[90dvh] overflow-y-auto"
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
    </DialogContent>
  </VQueryDialog>
</template>
