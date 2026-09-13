<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue';
import type { IFilerItemFormatted } from '@global-torque/invest-core/filer/documentFormatter';
import { VTableDocumentItem } from '@global-torque/invest-widgets/filer';
import { VFormInputSearch } from '@global-torque/ui-kit/form';
import { Search, X } from '@lucide/vue';
import SearchApproved from '@global-torque/invest-widgets/icons/images/search.svg?component';
import ClearApproved from '@global-torque/invest-widgets/icons/images/close.svg?component';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@global-torque/ui-primitives/table';
import { TabsList, TabsTrigger } from '@global-torque/ui-primitives/tabs';
import { VUrlSyncedTabs } from '@global-torque/ui-kit/url-synced-tabs';

const ALL_DOCUMENTS_TAB = 'all';
const props = defineProps({
  folders: { type: Array as PropType<string[]>, default: () => [] },
  files: { type: Array as PropType<IFilerItemFormatted[]>, default: () => [] },
  tableHeader: { type: Array as PropType<Array<{ text: string; value?: string }>>, default: () => [] },
  loadingTable: Boolean,
  online: { type: Boolean, default: true },
});

const currentTab = ref(ALL_DOCUMENTS_TAB);
const search = ref('');
const tabs = computed(() => [
  { value: ALL_DOCUMENTS_TAB, label: 'All' },
  ...props.folders.map(value => ({ value, label: value })),
]);
const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_]+/g, '-');
const filteredFiles = computed(() => props.files.filter((file) => {
  const matchesTab = currentTab.value === ALL_DOCUMENTS_TAB
    || normalize(file.category) === normalize(currentTab.value);
  const matchesSearch = !search.value
    || (file.name?.toLowerCase() ?? '').includes(search.value.toLowerCase());
  return matchesTab && matchesSearch;
}));
watch(currentTab, () => {
  search.value = '';
});
</script>

<template>
  <div class="offers-documents">
    <div class="offers-documents__toolbar">
      <VUrlSyncedTabs
        v-model="currentTab"
        query-key="document-tab"
        :default-value="ALL_DOCUMENTS_TAB"
      >
        <TabsList>
          <TabsTrigger
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
          >
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>
      </VUrlSyncedTabs>
      <VFormInputSearch
        v-model="search"
        aria-label="Search documents"
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
    <Table class="[&_td]:whitespace-normal">
      <TableHeader>
        <TableRow>
          <TableHead
            v-for="header in tableHeader"
            :key="header.value ?? header.text"
          >
            {{ header.text }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <VTableDocumentItem
          v-for="file in filteredFiles"
          :key="file.key"
          :data="file"
          :search="search"
          :online="online"
        />
        <TableRow v-if="!loadingTable && filteredFiles.length === 0">
          <td :colspan="Math.max(tableHeader.length, 1)">
            No documents match your search or selected category.
          </td>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>

<style scoped lang="scss">
.offers-documents__toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 19px;
  flex-wrap: wrap;
}
</style>
