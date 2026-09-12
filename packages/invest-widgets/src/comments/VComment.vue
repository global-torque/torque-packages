<script setup lang="ts">
import { Badge } from '@global-torque/ui-primitives/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@global-torque/ui-primitives/avatar';
import { badgeToneClass } from '@global-torque/ui-kit/badge-tone';
import { UserIcon } from '@lucide/vue';

defineProps({
  imageSrc: String,
  text: String,
  date: String,
  title: String,
  background: {
    type: String,
    default: 'var(--ui-color-subtle, #F0F4FF)',
  },
  tag: String,
});

</script>

<template>
  <div
    class="TheComment the-comment"
    itemscope
    itemtype="https://schema.org/Comment"
  >
    <Avatar
      class="the-comment__image size-8"
      itemprop="image">
      <AvatarImage
        v-if="imageSrc"
        :src="imageSrc"
        alt="avatar image"
      />
      <AvatarFallback><UserIcon /></AvatarFallback>
    </Avatar>
    <div class="the-comment__content">
      <div class="the-comment__top">
        <div class="the-comment__left">
          <span
            v-if="title"
            itemprop="author"
            class="the-comment__title is--h5__title"
          >
            {{ title }}
          </span>
          <Badge
            v-if="tag && tag !== 'none'"
            variant="outline"
            :class="badgeToneClass('primary')"
          >
            {{ tag[0].toUpperCase() + tag.slice(1) }}
          </Badge>
        </div>
        <div
          v-if="date"
          class="the-comment__right"
          itemprop="dateCreated"
        >
          <span
            class="the-comment__date is--small"
            itemprop="datePublished"
          >
            {{ date }}
          </span>
        </div>
      </div>
      <p
        class="the-comment__text"
        itemprop="text"
      >
        {{ text }}
      </p>
    </div>
  </div>
</template>

<style lang="scss">
.the-comment {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  align-self: stretch;

  &__content {
    display: flex;
    width: 100%;
    padding: 16px 20px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    align-self: stretch;
    border-radius: 12px 12px 12px 0;
    background: v-bind(background);
  }

  &__text {
    color: var(--foreground);
  }

  &__top {
    display: flex;
    align-items: center;
    gap: 8px;
    align-self: stretch;
    justify-content: space-between;
  }

  &__title {
    color: var(--foreground);
  }

  &__date {
    color: var(--muted-foreground);
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
