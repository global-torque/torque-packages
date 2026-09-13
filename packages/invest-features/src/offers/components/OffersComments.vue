<script setup lang="ts">
import VFormComments from './VFormComments.vue';
import VCommentItems from '@global-torque/invest-widgets/comments/VCommentItems.vue';
import { useOffersComments } from './logic/useOffersComments.ts';

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
  isLoading,
} = useOffersComments(props);
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
    />
    <VCommentItems
      v-if="(comments && comments.length > 0) || isLoading"
      :comments="comments"
      :loading="isLoading"
    />
    <p
      v-else
      class="offer-comments__info"
    >
      There are no questions yet, but you can be the first!
    </p>
  </div>
</template>

<style lang="scss">
.offer-comments {

  &__skeleton {
    margin-top: 20px;
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
