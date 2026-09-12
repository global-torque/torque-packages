<script setup lang="ts">
import { computed } from 'vue';
import { VFormInput } from '@global-torque/ui-kit/form';
import { Button } from '@global-torque/ui-primitives/button';
import { VFormCheckbox } from '@global-torque/ui-kit/form';
import { VFormGroup } from '@global-torque/ui-kit/form';
import { VFormRadio } from '@global-torque/ui-kit/form';
import { useVFormComments } from './logic/useVFormComments.ts';
import { Spinner } from '@global-torque/ui-primitives/spinner';

const props = defineProps({
  offerId: {
    type: Number,
    required: true,
  },
  offerName: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const {
  model,
  isDisabledButton,
  disclosureCheckbox,
  relatedOptionsFiltered,
  isAuth,
  sendQuestion,
  signInHandler,
  errorData,
  setOfferCommentState,
  setOfferCommentOptionsState,
  isFieldRequired,
  getErrorText,
} = useVFormComments(props.offerId);

const commentErrorText = computed(() => (
  getErrorText('comment', errorData)
    .flat()
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
));
</script>

<template>
  <div class="VFormComments v-form-comments">
    <VFormGroup
      v-slot="VFormGroupProps"
      :required="isFieldRequired('comment')"
      :error-text="commentErrorText"
      data-testid="comment-group"
      label="Ask a Question"
      class="v-form-comments__comment-wrap"
    >
      <VFormInput
        :model-value="model.comment"
        :is-error="VFormGroupProps.isFieldError"
        placeholder="Ask a question"
        name="question"
        size="large"
        :loading="loading"
        @update:model-value="model.comment = $event"
      />
    </VFormGroup>
    <div class="v-form-comments__disclosure">
      <div class="v-form-comments__checkbox-wrap">
        <VFormCheckbox
          v-model="disclosureCheckbox"
          class="v-form-comments__checkbox"
        >
          Disclosure: I have a financial relationship with {{ offerName }}
        </VFormCheckbox>

        <Button
          v-if="!isAuth"
          class="v-form-comments__button"
          @click="signInHandler"
          size="lg"
          :disabled="loading"
        >
            <Spinner v-if="loading" />
          Log in
        </Button>
        <Button
          v-else
          :disabled="isDisabledButton || loading || setOfferCommentState.loading || setOfferCommentOptionsState.loading"
          class="v-form-comments__button"
          @click="sendQuestion"
          size="lg"
        >
            <Spinner v-if="loading" />
          Post
        </Button>
      </div>
      <Transition
        name="fade"
        mode="out-in"
      >
        <div
          v-if="disclosureCheckbox"
          class="v-form-comments__related"
        >
          <VFormGroup
            v-slot="VFormGroupProps"
            :model="model"
            path="related"
            label="I am an:"
          >
            <VFormRadio
              v-model="model.related"
              row
              :is-error="VFormGroupProps.isFieldError"
              :options="relatedOptionsFiltered"
              class="v-form-comments__radio"
            />
          </VFormGroup>
        </div>
      </Transition> 
    </div>
  </div>
</template>

<style lang="scss">
.v-form-comments {
  padding-bottom: 60px;
  border-bottom: 1px solid #CED4DA;

  @media screen and (width < 768px) {
    padding-bottom: 24px;
  }

  &__comment-wrap {
    width: 100%;
    margin-bottom: 20px;
  }

  &__disclosure {
    width: 100%;
  }

  &__checkbox-wrap {
    display: flex;
    justify-content: space-between;

    @media screen and (max-width: 1024px) {
      flex-direction: column;;
    }
  }

  &__related {
    @media screen and (width < 768px) {
      margin-top: 20px;
    }
  }

  &__button {
    @media screen and (width > 768px) {
      margin-top: 0 !important;
    }

    @media screen and (width < 768px) {
      margin-top: 20px !important;
    }
  }

  .v-form-radio__item-input {
    margin: 0;
  }

  .v-form-group__input {
    margin: 0;
  }
}

</style>
