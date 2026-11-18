<script setup lang="ts">
import { ref, watch } from 'vue';
import type { IOfferComment } from '@global-torque/domain-types/offerTypes';
import VFormComments from './VFormComments.vue';
import VCommentItems from '@global-torque/invest-widgets/comments/VCommentItems.vue';
import { useOffersComments } from './logic/useOffersComments.ts';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';

const props = withDefaults(defineProps<{
  offerId: number;
  offerName: string;
  loading?: boolean;
  allowSubmission?: boolean;
}>(), {
  loading: false,
  allowSubmission: false,
});

const {
  comments,
  commentsLoading,
  isLoading,
  addSubmittedComment,
} = useOffersComments(props);
const isSubmitting = ref(false);

const handleSubmitState = (value: boolean) => {
  isSubmitting.value = value;
};

const handleSubmitted = (comment: IOfferComment) => {
  addSubmittedComment(comment);
};

watch(() => props.allowSubmission, (allowSubmission) => {
  if (!allowSubmission) isSubmitting.value = false;
});
</script>

<template>
  <div
    class="OffersComments offer-comments"
    itemprop="review"
    itemscope
    itemtype="https://schema.org/Review"
  >
    <VFormComments
      v-if="allowSubmission"
      :offer-id="offerId"
      :offer-name="offerName"
      :loading="isLoading"
      @submit-state="handleSubmitState"
      @submitted="handleSubmitted"
    />
    <VCommentItems
      v-if="(comments && comments.length > 0) || commentsLoading || isSubmitting"
      :comments="comments"
      :loading="commentsLoading"
    />
    <div
      v-if="isSubmitting"
      role="status"
      aria-live="polite"
      aria-label="Posting your question"
      class="offer-comments__pending"
    >
      <Skeleton
        class="offer-comments__skeleton"
        aria-hidden="true"
        :style="{ width: '100%', height: '72px' }"
      />
    </div>
    <p
      v-if="comments.length === 0 && !commentsLoading && !isSubmitting"
      class="offer-comments__info"
    >
      There are no questions yet, but you can be the first!
    </p>
  </div>
</template>

<style lang="scss">
.offer-comments {

  &__skeleton {
    width: 100%;
  }

  &__pending {
    margin-top: 0;
  }

  &__info {
    margin-top: 60px;
    text-align: center;
    font-size: 20px;
    line-height: 32px;

    @media screen and (width < 768px) {
      margin-top: 20px;
    }
  }
}
</style>
