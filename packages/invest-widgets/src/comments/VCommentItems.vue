<script setup lang="ts">
import { PropType } from 'vue';
import TheCommentThread, { IOfferComment } from './VCommentThread.vue';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';

defineProps({
  comments: {
    type: Array as PropType<IOfferComment[]>,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <div class="VCommentItems v-comment-items">
    <div class="v-comment-items__title is--h2__title">
      <slot>Questions</slot>
    </div>
    <Skeleton
      v-if="loading"
      class="v-comment-items__skeleton"
      :style="{ width: '100%', height: '22px' }"
    />
    <template v-else>
      <TheCommentThread
        v-for="item in comments"
        :key="item.created_at"
        :comment="item"
        class="v-comment-items__thread"
      />
    </template>
  </div>
</template>

<style lang="scss">
.v-comment-items {
  margin-top: 60px;

  &__title {
    margin-bottom: 24px;
  }

  &__thread {
    margin-bottom: 32px;
  }
}
</style>
