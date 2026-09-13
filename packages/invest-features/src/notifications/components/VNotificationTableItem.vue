<script setup lang="ts">
import { formatToDate } from '@global-torque/invest-core/helpers/formatters/formatToDate';
import { PropType, ref } from 'vue';
import { Badge } from '@global-torque/ui-primitives/badge';
import { Button } from '@global-torque/ui-primitives/button';
import { ArrowRightIcon } from '@global-torque/invest-widgets/icons';
import { TableCell, TableRow } from '@global-torque/ui-primitives/table';
import { IFormattedNotification } from '@global-torque/domain-types/notificationsTypes';
import { useNotifications } from '../useNotifications.ts';
import { reportError } from '@global-torque/invest-runtime/error/errorReporting';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';
import { badgeToneClass } from '@global-torque/ui-kit/badge-tone';

const notificationsStore = useNotifications();

const isLoading = ref(false);

const props = defineProps({
  data: Object as PropType<IFormattedNotification>,
  search: String,
  isStaticSite: String, // is the component external and nee links instead of router
  loading: Boolean,
});

const onMarkAsRead = async () => {
  if (!props.data?.id) return;

  isLoading.value = true;
  try {
    await notificationsStore.markAsReadById(props.data.id);
  }
  catch (e) {
    reportError(e, 'Failed to mark notification as read');
  }
  finally {
    isLoading.value = false;
  }
};

const onButtonClick = async () => {
  if (!props.data?.buttonHref) return;

  await onMarkAsRead();
  notificationsStore.onSidebarToggle(false);
  window.location.href = props.data.buttonHref;
};

const onMessageClick = () => {
  notificationsStore.onSidebarToggle(false);
};
</script>
<template>
  <TableRow
    class="VTableNotificationItem v-table-notification-item"
    :class="{ 'is--unread': data?.isUnread }"
  >
    <TableCell class="v-table-notification-item__badge-cell">
      <template v-if="!loading && !isLoading">
        <Badge
          :key="data?.tagText"
          v-highlight="search"
          variant="outline"
          :class="badgeToneClass((data?.tagBackground || 'default') as any)"
        >
          <span class="v-table-notification-item__tag-text">
            {{ data?.tagText }}
          </span>
        </Badge>
      </template>

      <Skeleton
        v-else

        class="v-table-notification-item__skeleton"
      />
    </TableCell>
    <TableCell class="v-table-notification-item__text-cell">
      <div class="v-table-notification-item__content-wrap">
        <div class="v-table-notification-item__text">
          <template v-if="!loading && !isLoading">
            <span
              v-if="data?.created_at"
              :key="data?.created_at"
              class="v-table-notification-item__date is--h6__title"
            >
              {{ formatToDate(new Date(data?.created_at).toISOString(), true) }}
            </span>
          </template>

          <Skeleton
            v-else
            class="v-table-notification-item__date is--h6__title"

            :style="{ width: '100px', height: '21px' }"
          />

          <template v-if="!loading && !isLoading">
            <p
              :key="data?.content"
              v-highlight="search"
              v-dompurify-html="data?.content"
              class="v-table-notification-item__content is--body"
              role="button"
              tabindex="0"
              :aria-label="`Click to view notification: ${data?.content || 'Notification'}`"
              @click="onMessageClick"
              @keydown.enter="onMessageClick"
              @keydown.space="onMessageClick"
            />
          </template>

          <Skeleton
            v-else
            class="v-table-notification-item__content is--body"

            :style="{ width: '100%', height: '25px' }"
          />
        </div>

        <template v-if="!loading && !isLoading">
          <Button
            :key="data?.buttonText"
            class="v-table-notification-item__button"
            variant="link"
            size="sm"
            @click.prevent="onButtonClick"
          >
            {{ data?.buttonText }}
            <ArrowRightIcon
              class="v-table-notification-item__icon"
              alt="modal layout close icon"
            />
          </Button>
        </template>

        <Skeleton
          v-else

          :style="{ width: '143px', height: '32px' }"
        />
      </div>
      <span
        v-if="data?.isUnread"
        class="v-table-notification-item__dot"
        role="button"
        tabindex="0"
        aria-label="Mark notification as read"
        @click.stop="onMarkAsRead"
        @keydown.enter="onMarkAsRead"
        @keydown.space="onMarkAsRead"
      />
      <Button
        v-if="data?.isUnread"
        class="v-table-notification-item__mark-button"
        variant="link"
        size="sm"
        @click.stop="onMarkAsRead"
      >
        Mark as read
      </Button>
    </TableCell>
  </TableRow>
</template>

<style lang="scss">
.v-table-notification-item {
  @media screen and (width > 768px){
    display: table-row;
  }

  @media screen and (width < 768px){
    display: flex;
    flex-direction: column;
    position: relative;
  }

  &.is--unread td {
    background-color: var(--ui-color-canvas, var(--muted));

    @media screen and (width > 768px){
      position: relative;
    }
  }

  &__skeleton {
    width: 86px;
    height: 34px;
    border-radius: 24px;
  }

  &__date {
    color: var(--ui-color-text-muted, #495057);
    margin-bottom: 8px;
    display: block;
  }

  &__content {
    color: var(--ui-color-text-secondary, #343A40);

    a {
      font-weight: 700;
      font-size: 16px;
      line-height: 26px;
      text-decoration: underline;
      transition: 0.3s all  ease-in-out;
      color: var(--primary);
      cursor: pointer;

      &:hover {
        text-decoration: none;
      }
    }
  }

  &__type {
    display: flex;
    flex-shrink: 0;
    width: 100%;
  }

  &__tag-text {
    text-transform: capitalize;
    white-space: nowrap;
  }

  &__content-wrap {
    display: flex;
    align-items: center;
    gap: 32px;
    justify-content: space-between;
    height: 100%;

    @media screen and (width <= 768px){
      flex-direction: column;
      min-width: 300px;
      align-items: flex-start;
    }
  }

  &__dot {
    position: absolute;
    right: 8px;
    top: 8px;
    width: 6px;
    height: 6px;
    background-color: var(--primary);
    border-radius: 100%;
    z-index: 0;
    cursor: pointer;

    @media screen and (width < 768px){
      display: none;
    }
  }

  &__mark-button {
    display: none;
    position: absolute;
    right: 8px;
    top: 8px;

    @media screen and (width <= 768px){
      display: inline-flex;
      align-self: flex-start;
      margin-top: 8px;
    }
  }

  &__button {
    flex-shrink: 0;

    @media screen and (width < 768px){
      align-self: flex-start;
      width: 100%;
    }
  }

  &__icon {
    width: 16px;
  }

  &__text-cell {
    @media screen and (width > 768px){
      width: calc(100% - 160px);
    }

    @media screen and (width < 768px){
      width: 100%;
    }
  }

  &__badge-cell {
    @media screen and (width > 768px){
      width: 160px;
    }

    @media screen and (width < 768px){
      width: 100%;
    }
  }

  &__text {
    width: 100%;
  }
}
</style>
