<script setup lang="ts">
import { PropType, computed } from 'vue';
import VComment from './VComment.vue';
import { formatToDate } from '@global-torque/invest-core/helpers/formatters/formatToDate';

export interface IOfferComment {
  created_at: string;
  comment: string;
  related?: string;
  user: {
    first_name: string;
    last_name: string;
  };
}

defineProps({
  comment: {
    type: Object as PropType<IOfferComment>,
    required: true,
  },
});

const showAnswer = computed(() => false);
</script>

<template>
  <div class="VCommentThread v-comment-thread">
    <VComment
      class="v-comment-thread__comment"
      :title="`${comment?.user.first_name} ${comment?.user.last_name}`"
      :date="formatToDate(new Date(comment.created_at).toISOString())"
      :text="comment?.comment"
      :tag="comment.related"
    />

    <VComment
      v-if="showAnswer"
      class="v-comment-thread__comment is--reply"
      :title="`${comment?.user.first_name} ${comment?.user.last_name}`"
      :date="formatToDate(new Date(comment.created_at).toISOString())"
      :text="comment?.comment"
      :tag="comment.related"
      background="var(--ui-color-canvas, var(--muted))"
    />
  </div>
</template>

<style lang="scss">
.v-comment-thread {
  .is--reply {
    margin-left: 16px;
    border-left: 1px solid var(--border);
    padding-left: 12px;
    margin-top: 12px;
  }
}
</style>
