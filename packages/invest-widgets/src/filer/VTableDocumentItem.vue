<script setup lang="ts">
import { PropType, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Badge } from '@global-torque/ui-primitives/badge';
import {
  DownloadFileIcon as download,
  FileIcon as file,
} from '../icons/file';
import { TableCell, TableRow } from '@global-torque/ui-primitives/table';
import { IFilerItemFormatted } from '@global-torque/invest-core/filer/documentFormatter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@global-torque/ui-primitives/tooltip';
import { badgeToneClass } from '@global-torque/ui-kit/badge-tone';

const props = defineProps({
  data: Object as PropType<IFilerItemFormatted>,
  search: String,
  online: {
    type: Boolean,
    default: true,
  },
});
const nameElementRef = ref<HTMLElement>();
const isTextOverflowing = ref(false);

const checkTextOverflow = () => {
  if (!nameElementRef.value) return false;
  const element = nameElementRef.value;
  return element.scrollWidth > element.clientWidth;
};

const shouldShowTooltip = computed(() =>
  props.data?.name && isTextOverflowing.value,
);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!nameElementRef.value) return;
  resizeObserver = new ResizeObserver(() => {
    isTextOverflowing.value = checkTextOverflow();
  });
  resizeObserver.observe(nameElementRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

</script>
<template>
  <TableRow
    class="VTableDocumentItem v-table-document-item"
    :data-document-key="data?.key"
  >
    <TableCell>
      <div class="v-table-document-item__name-wrap">
        <file
          alt="file icon"
          class="v-table-document-item__icon"
        />
        <TooltipProvider
          v-if="shouldShowTooltip"
          :delay-duration="100"
        >
          <Tooltip>
            <TooltipTrigger as-child>
              <a
                ref="nameElementRef"
                v-highlight="search"
                :href="online ? data?.actionUrl : undefined"
                target="_blank"
                rel="noopener noreferrer"
                class="v-table-document-item__name"
                :aria-label="online ? `Open document ${data?.name}` : `Open document ${data?.name} unavailable offline`"
                :aria-disabled="!online"
                :tabindex="online ? 0 : -1"
                :title="online ? `Open document ${data?.name}` : 'Documents are unavailable while offline'"
                @click.stop="!online && $event.preventDefault()"
              >
                {{ data?.name }}
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <div v-highlight="search">
                {{ data?.name }}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <a
          v-else
          ref="nameElementRef"
          v-highlight="search"
          :href="online ? data?.actionUrl : undefined"
          target="_blank"
          rel="noopener noreferrer"
          class="v-table-document-item__name"
          :aria-label="online ? `Open document ${data?.name}` : `Open document ${data?.name} unavailable offline`"
          :aria-disabled="!online"
          :tabindex="online ? 0 : -1"
          :title="online ? `Open document ${data?.name}` : 'Documents are unavailable while offline'"
          @click.stop="!online && $event.preventDefault()"
        >
          {{ data?.name }}
        </a>
        <Badge
          v-if="data?.isNew"
          class="is--background-red-light"
          variant="outline"
          :class="badgeToneClass('default')"
        >
          New
        </Badge>
      </div>
    </TableCell>
    <TableCell class="v-table-document-item__tags">
      <Badge
        :class="[data?.tagColor, badgeToneClass('default')]"
        variant="outline"
      >
        {{ data?.typeFormatted }}
      </Badge>
    </TableCell>
    <TableCell class="v-table-document-item__date-wrap is--small is--lt-tablet-hide">
      {{ data?.date }}
    </TableCell>
    <TableCell
      class="v-table-document-item__download-wrap"
    >
      <a
        :href="online ? data?.actionUrl : undefined"
        target="_blank"
        rel="noopener noreferrer"
        class="v-table-document-item__action is--small"
        :aria-label="online ? `Open document ${data?.name}` : `Open document ${data?.name} unavailable offline`"
        :aria-disabled="!online"
        :tabindex="online ? 0 : -1"
        :title="online ? 'Open document' : 'Documents are unavailable while offline'"
        @click.stop="!online && $event.preventDefault()"
      >
        <download
          aria-hidden="true"
          class="v-table-document-item__download-icon"
        />
      </a>
    </TableCell>
  </TableRow>
</template>

<style lang="scss">
.v-table-document-item {
  width: 100%;
  align-items: center;

  @media screen and (width <= 768px){
    /* Make table rows more compact on mobile */
    td {
      padding: 8px 12px !important;
    }
  }

  &__icon {
    width: 20px;
    height: 20px;
    color: var(--ui-color-text-muted, var(--color-text-meta));
    flex-shrink: 0;
  }

  &__name-wrap {
    display: flex;
    align-items: center;
    gap: 16px;

    @media screen and (width <= 768px){
      gap: 8px;
    }
  }

  &__name {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 3px;
    }

    &[aria-disabled='true'] {
      color: var(--muted-foreground);
      cursor: not-allowed;
      text-decoration: none;
    }

    @media screen and (width <= 768px){
      max-width: 200px;
      flex-wrap: wrap;
    }
  }

  &__download-icon {
    width: 16px;
  }

  &__action {
    display: inline-flex;
    align-items: center;
    color: var(--primary);
    text-decoration: none;

    &:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 3px;
    }

    &[aria-disabled='true'] {
      color: var(--color-text-disabled);
      cursor: not-allowed;
    }
  }

  &__tags {
    gap: 4px;
    width: 260px;

    @media screen and (width <= 768px){
      width: fit-content;
      display: flex;
      justify-content: center;
    }
  }
}
</style>
