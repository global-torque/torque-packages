<script setup lang="ts">
import { TableCell, TableRow } from '@global-torque/ui-primitives/table';
import { Skeleton } from '@global-torque/ui-primitives/skeleton';

</script>
<template>
  <TableRow
    class="VTableNotificationItem v-table-notification-item is--unread"
  >
    <TableCell class="v-table-notification-item__badge-cell">
      <Skeleton
        :style="{ width: '86px', height: '34px', borderRadius: '24px' }"
      />
    </TableCell>
    <TableCell class="v-table-notification-item__text-cell">
      <div class="v-table-notification-item__content-wrap">
        <div class="v-table-notification-item__text">
          <Skeleton
            class="v-table-notification-item__date is--h6__title"
            :style="{ width: '100px', height: '21px' }"
          />
          <Skeleton
            class="v-table-notification-item__content is--body"
            :style="{ width: '200px', height: '25px' }"
          />
        </div>

        <Skeleton
          :style="{ width: '133px', height: '32px' }"
        />
      </div>
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

  &__date {
    color: var(--ui-color-text-muted, var(--color-text-meta));
    margin-bottom: 8px;
    display: block;
  }

  &__content {
    color: var(--ui-color-text-secondary, var(--color-text-strong));

    @media screen and (width < 768px){
      width: 100% !important;
    }

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
