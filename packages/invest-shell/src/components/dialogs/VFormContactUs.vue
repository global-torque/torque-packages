<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';
import ChevronDownApproved from '@global-torque/invest-widgets/icons/images/chevron-down.svg?component';
import { Button } from '@global-torque/ui-primitives/button';
import { VFormGroup, VFormInput, VFormSelect, VFormTextarea } from '@global-torque/ui-kit/form';
import { contactUsSubjects, useContactUsForm } from './useContactUsForm';
import type { ContactSubjectPosition, ContactUsSessionPrefill, ContactUsSubmit } from './useContactUsForm';

const props = withDefaults(defineProps<{
  submitContact: ContactUsSubmit;
  sessionPrefill?: ContactUsSessionPrefill;
  subject?: string;
  subjectPosition?: ContactSubjectPosition;
  active?: boolean;
  surface?: 'dialog' | 'page';
  contactEmail: string;
}>(), { active: true, surface: 'page' });
const emit = defineEmits<{ accepted: [] }>();
const {
  model, normalized, hideIdentityFields, identityError, touched,
  pending, error, submitted, attempted, errors, valid, submit,
} = useContactUsForm({
  active: () => props.active,
  subject: () => props.subject,
  session: () => props.sessionPrefill,
  submit: payload => props.submitContact(payload),
  accepted: () => emit('accepted'),
  surface: props.surface,
});
</script>

<template>
  <form
    class="v-form-contact-us"
    novalidate
    :aria-busy="pending"
    @submit.prevent="submit"
  >
    <p
      v-if="submitted"
      role="status"
    >
      Your message has been submitted.
    </p>
    <template v-if="hideIdentityFields">
      <input
        type="hidden"
        name="name"
        :value="normalized.name"
      >
      <input
        type="hidden"
        name="email"
        :value="normalized.email"
      >
    </template>
    <template v-else>
      <VFormGroup
        label="Name"
        required
        :error-text="attempted && errors.name ? [errors.name] : []"
      >
        <VFormInput
          v-model="model.name"
          name="name"
          autocomplete="name"
          :disabled="pending"
          @input="touched.name = true"
        />
      </VFormGroup>
      <VFormGroup
        label="Email"
        required
        :error-text="attempted && errors.email ? [errors.email] : []"
      >
        <VFormInput
          v-model="model.email"
          name="email"
          type="email"
          autocomplete="email"
          maxlength="254"
          :disabled="pending"
          @input="touched.email = true"
        />
      </VFormGroup>
    </template>
    <p
      v-if="identityError"
      role="alert"
    >
      {{ identityError }}
    </p>
    <VFormGroup
      label="Subject"
      required
      :error-text="attempted && errors.subject ? [errors.subject] : []"
    >
      <VFormSelect
        v-model="model.subject"
        name="subject"
        :options="contactUsSubjects"
        :content-position="subjectPosition"
        placeholder="Select a subject"
        :disabled="pending"
      >
        <template #icon>
          <span
            class="invest-form-select-icon"
            aria-hidden="true"
          >
            <ChevronDown class="invest-form-select-icon__outline size-4" />
            <ChevronDownApproved class="invest-form-select-icon__approved size-[14px]" />
          </span>
        </template>
      </VFormSelect>
    </VFormGroup>
    <VFormGroup
      label="Message"
      required
      :error-text="attempted && errors.message ? [errors.message] : []"
    >
      <VFormTextarea
        v-model="model.message"
        name="message"
        rows="4"
        :disabled="pending"
      />
    </VFormGroup>
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
    </p>
    <Button
      type="submit"
      :disabled="pending || !valid"
    >
      {{ pending ? 'Submitting…' : 'Submit' }}
    </Button>
    <p class="v-form-contact-us__support">
      You can also email <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>.
    </p>
  </form>
</template>

<style scoped lang="scss">
.v-form-contact-us {
  display: grid;
  gap: 20px;
  text-align: left;
  &__support { text-align: center; overflow-wrap: anywhere; }
}
</style>
