<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { VFormInputSearch } from '@global-torque/ui-kit/form';
import { Search, X } from '@lucide/vue';
import FilterApproved from '@global-torque/invest-widgets/icons/images/filter.svg?component';
import SearchApproved from '@global-torque/invest-widgets/icons/images/search.svg?component';
import ClearApproved from '@global-torque/invest-widgets/icons/images/close.svg?component';
import { VFilter } from '@global-torque/ui-kit/filter';
import { computed } from 'vue';
import { Button } from '@global-torque/ui-primitives/button';
import { CheckIcon } from '@global-torque/invest-widgets/icons';
import { TabsList, TabsTrigger } from '@global-torque/ui-primitives/tabs';
import { VUrlSyncedTabs } from '@global-torque/ui-kit/url-synced-tabs';
import { Table, TableBody, TableEmpty } from '@global-torque/ui-primitives/table';
import { useNotifications, type NotificationFilter } from '../useNotifications.ts';
import VNotificationTableItem from './VNotificationTableItem.vue';
import VNotificationTableItemSkeleton from './VNotificationTableItemSkeleton.vue';

const props = defineProps({
  small: Boolean,
  isStaticSite: String, // is the component external and nee links instead of router
});

const notificationsStore = useNotifications();
const {
  filterSettings, tabsSettings, currentTab, search, showSearch,
  showFilter, filterResults, notificationUserLength, showMarkAll,
  showFilterPagination: showFilterPaginationStore,
  isLoading, tableData,
} = storeToRefs(notificationsStore);

const data = computed(() => (
  props.small ? tableData.value.slice(0, 15) : tableData.value));

const showFilterPagination = computed(() => (
  showFilterPaginationStore.value && !props.small && (filterResults.value > 0)));

const onMarkAllAsRead = () => {
  notificationsStore.markAllAsRead();
};
const onApplyFilter = (items: NotificationFilter[]) => {
  notificationsStore.onApplyFilter(items);
};
</script>
<template>
  <aside class="WdNotificationTable wd-notification-table is--no-margin">
    <div class="wd-notification-table__toolbar">
      <div class="wd-notification-table__toolbar-left">
        <VUrlSyncedTabs
          v-model="currentTab"
          :default-value="currentTab"
          query-key="notification-tab"
          class="wd-notification-table__tabs"
        >
          <TabsList>
            <TabsTrigger
              v-for="(tab, tabIndex) in tabsSettings"
              :key="tabIndex"
              :value="tab.value"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </VUrlSyncedTabs>
        <div
          v-if="!small"
          class="wd-notification-table__search"
        >
          <VFormInputSearch
            v-model="search"
            :disabled="!showSearch"
            size="small"
          >
            <template #search-icon>
              <span
                class="invest-form-search-icon"
                aria-hidden="true"
              >
                <Search
                  class="invest-form-search-icon__outline v-form-input-search__search-icon
                    size-5 text-muted-foreground"
                />
                <SearchApproved class="invest-form-search-icon__approved" />
              </span>
            </template>
            <template #clear-icon>
              <span
                class="invest-form-search-icon"
                aria-hidden="true"
              >
                <X class="invest-form-search-icon__outline v-form-input-search__close-icon" />
                <ClearApproved class="invest-form-search-icon__approved invest-form-search-icon__approved--clear" />
              </span>
            </template>
          </VFormInputSearch>
        </div>
        <VFilter
          :items="filterSettings"
          :disabled="!showFilter"
          filters-to-url
          query-key="notification-filter"
          class="wd-notification-table__filter"
          @apply="onApplyFilter"
        >
          <template #icon>
            <svg
              class="v-filter__button-icon wd-notification-table__filter-icon--default"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6.5 11V8.75L2 3.5V2H14V3.5L9.5 8.75V13.25L6.5 11Z"
                fill="currentColor"
              />
            </svg>
            <FilterApproved
              class="v-filter__button-icon wd-notification-table__filter-icon--approved"
              aria-hidden="true"
            />
          </template>
        </VFilter>
        <span v-if="showFilterPagination">
          Showing {{ filterResults }} of {{ notificationUserLength }}
        </span>
      </div>
      <Button
        :disabled="!showMarkAll"
        class="wd-notification-table__mark-all"
        variant="link"
        size="sm"
        @click.stop="onMarkAllAsRead"
      >
        <CheckIcon
          alt="download icon"
          class="wd-notification-table__check-icon"
        />
        Mark All as Read
      </Button>
    </div>
    <Table class="[&_td]:p-3 [&_td]:text-[12px] [&_td]:leading-[18px] [&_th]:p-3 [&_td]:whitespace-normal">
      <TableBody v-if="isLoading">
        <VNotificationTableItemSkeleton
          v-for="index in 10"
          :key="index"
        />
      </TableBody>
      <TableBody v-else-if="data.length">
        <VNotificationTableItem
          v-for="item in data"
          :key="item.id"
          :data="item"
          :search="search"
          :is-static-site="isStaticSite"
        />
      </TableBody>
      <TableBody v-else>
        <TableEmpty :colspan="2">
          <p v-if="notificationUserLength === 0">
            Currently no notifications yet.
          </p>
          <p v-else>
            Currently no notifications in this category.
          </p>
        </TableEmpty>
      </TableBody>
    </Table>
  </aside>
</template>

<style lang="scss">
.wd-notification-table {
  > [data-slot='table-container'] {
    padding: var(--ui-investor-table-wrapper-padding, 0);
    position: var(--ui-notification-table-wrapper-position, revert-layer);
  }

  [data-slot='table-body'] > [data-slot='table-row'] {
    border-top-color: var(--ui-color-border-subtle, var(--border));

    &:last-child {
      border-bottom: var(--ui-investor-table-final-row-border, 0);
    }

    &:hover {
      background: var(--ui-color-canvas, var(--muted));
    }
  }

  [data-slot='tabs-list']:not([data-variant='line']) {
    position: var(--ui-secondary-tabs-position, revert-layer);
    background: var(--ui-color-border-subtle, var(--border));
  }

  [data-slot='tabs-trigger']:not([data-variant='line'])[data-state='active'] {
    background: var(--ui-color-surface, var(--background));
    box-shadow: var(--ui-shadow-control,
      0 2px 5px 1px color-mix(in srgb, var(--foreground) 3%, transparent),
      0 2px 3px -2px color-mix(in srgb, var(--foreground) 15%, transparent));
  }

  &__content {
    overflow-y: scroll;
    height: calc(100% - 49px);
    padding-right: 15px;
  }

  &__toolbar {
    display: flex;
    padding-bottom: 16px;
    align-items: center;
    gap: 8px;
    align-self: stretch;
    justify-content: space-between;
    flex-wrap: wrap;

    @media screen and (width <= 768px){
      flex-direction: column-reverse;
    }
  }

  &__table-header {
    display: flex;
    align-items: flex-start;
    align-self: stretch;
    width: 100%;
    color: var(--muted-foreground);
    font-size: 14px;
    font-style: normal;
    font-weight: 800;
    line-height: 21px;
    padding-right: 80px;
  }

  &__toolbar-left {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 75%;
    flex-wrap: wrap;

    @media screen and (width <= 768px){
      min-width: auto;
      width: 100%;
    }
  }

  &__filter {
    --v-filter-dropdown-min-width: 250px;
  }

  &__filter-icon--default {
    display: var(--ui-form-outline-icon-display, revert-layer);
  }

  &__filter-icon--approved {
    display: var(--ui-form-approved-icon-display, none);
  }

  &__mark-all {
    @media screen and (width <= 768px){
      align-self: flex-end;
    }
  }

  &__not-found {
    font-weight: 800;
    text-align: center;
    font-size: 18px;
    margin-top: 40px;
  }

  &__tabs {
    margin-right: 12px;
    flex-shrink: 0;

    @media screen and (width <= 768px){
      width: 100%;
      margin-right: 0;
    }
  }

  &__search {
    width: 32%;

    @media screen and (width <= 768px){
      width: 100%;
    }
  }

  &__check-icon {
    width: 16px;
  }
}
</style>
