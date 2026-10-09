<script setup lang="ts">
import { computed, PropType, ref, watch } from 'vue';
import { useResizeObserver } from '@vueuse/core';
import {
  type RouteLocationRaw,
  useRoute,
  useRouter,
} from 'vue-router';
import { Tabs, TabsList, TabsTrigger } from '@global-torque/ui-primitives/tabs';

interface ITab {
  value: string;
  label: string;
  to?: RouteLocationRaw;
  subTitle?: string;
}
const props = defineProps({
  tab: {
    type: String,
    required: true,
  },
  hideTabs: {
    type: Boolean,
    default: false,
  },
  retainUnderlineExtent: {
    type: Boolean,
    default: false,
  },
  centerActiveTab: {
    type: Boolean,
    default: false,
  },
  tabs: Object as PropType<{ [key: string]: ITab }>,
});

const route = useRoute();
const router = useRouter();
const tabsListRef = ref<InstanceType<typeof TabsList>>();
const tabsElement = computed<HTMLElement | undefined>(() => tabsListRef.value?.$el);
const underlineWidth = ref('100%');

function updateUnderlineExtent() {
  const element = tabsElement.value;
  if (!props.retainUnderlineExtent || !element) return;
  underlineWidth.value = `${element.scrollWidth}px`;
}

watch([tabsElement, () => props.retainUnderlineExtent], () => {
  underlineWidth.value = '100%';
  updateUnderlineExtent();
}, { flush: 'post' });

function centerSelectedTab() {
  const element = tabsElement.value;
  if (!props.centerActiveTab || !element) return;
  const activeTab = element.querySelector<HTMLElement>('[data-state="active"]');
  if (!activeTab) return;

  const activeRect = activeTab.getBoundingClientRect();
  const listRect = element.getBoundingClientRect();
  const tabCenter = activeRect.left - listRect.left + element.scrollLeft + activeRect.width / 2;
  const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
  const target = Math.max(0, Math.min(tabCenter - element.clientWidth / 2, maxScroll));
  if (Math.abs(element.scrollLeft - target) > 1) {
    element.scrollTo({ left: target, behavior: 'smooth' });
  }
}

watch([tabsElement, () => props.tab, () => props.centerActiveTab], centerSelectedTab, { flush: 'post' });
// Observe both the viewport and its labels so font loading can change overflow.
useResizeObserver(computed(() => tabsElement.value
  ? [tabsElement.value, ...Array.from(tabsElement.value.children) as HTMLElement[]]
  : []), () => {
  updateUnderlineExtent();
  centerSelectedTab();
});

const handleTabChange = (nextTab: string | number) => {
  if (typeof nextTab !== 'string' || nextTab === props.tab) {
    return;
  }

  const nextRouteTarget = props.tabs?.[nextTab]?.to;

  if (!nextRouteTarget) {
    return;
  }

  const nextResolvedRoute = router.resolve(nextRouteTarget);

  if (nextResolvedRoute.fullPath === route.fullPath) {
    return;
  }

  void router.push(nextRouteTarget);
};
</script>

<template>
  <div class="VPageTopInfoAndTabs v-page-top-info-and-tabs">
    <section class="v-page-top-info-and-tabs__top-info">
      <div class="wd-container">
        <slot name="top-info" />
      </div>
    </section>
    <Tabs
      v-if="!hideTabs"
      :model-value="tab"
      class="v-page-top-info-and-tabs__tabs"
      @update:model-value="handleTabChange"
    >
      <div class="wd-container">
        <div class="v-page-top-info-and-tabs__tab-viewport">
          <TabsList
            ref="tabsListRef"
            variant="line"
            class="relative max-w-full justify-start overflow-x-auto no-scrollbar pb-1.25 group-data-horizontal/tabs:h-auto"
            :class="{ 'v-page-top-info-and-tabs__retained-underline': retainUnderlineExtent }"
            :style="retainUnderlineExtent ? { '--page-tabs-underline-width': underlineWidth } : undefined"
            @scroll="updateUnderlineExtent"
          >
            <TabsTrigger
              v-for="(item, tabIndex) in tabs"
              :key="tabIndex"
              :value="item.value"
            >
              {{ item.label }}
              <template
                v-if="item.subTitle"
                #subtitle
              >
                {{ item.subTitle }}
              </template>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      <div class="v-page-top-info-and-tabs__tabs-content">
        <div class="wd-container">
          <slot name="tabs-content" />
        </div>
      </div>
    </Tabs>
    <div
      v-else
      class="v-page-top-info-and-tabs__tabs-content"
    >
      <div class="wd-container">
        <slot name="tabs-content" />
      </div>
    </div>
    <slot name="content" />
  </div>
</template>

<style lang="scss">
.v-page-top-info-and-tabs {
  width: 100%;
  background-color: var(--muted);
  position: relative;
  // height: calc(64px + 100%);
  // padding-top: 64px;
  margin-bottom: 90px;

  &__tab-viewport {
    position: relative;
    width: 100%;

    [data-slot='tabs-trigger'] {
      z-index: 10;
    }
  }

  &__retained-underline[data-slot='tabs-list'] {
    box-shadow: none;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: var(--page-tabs-underline-width, 100%);
      border-bottom: 2px solid var(--input);
    }
  }
  // @media screen and (max-width: 768px){
  //   height: calc(64px + 100%);
  //   padding-top: 64px;
  // }

  &__top-info {
    margin: 40px 0 45px;

    @media screen and (width <= 768px){
      margin: 26px 0;
    }
  }

  &__tabs-content {
    background: var(--background);
    padding-bottom: 40px;
    height: 100%;

    @media screen and (width < 768px) {
      padding-top: 24px;
    }

    @media screen and (width > 768px){
      min-height: 1000px;
    }
  }

  // Under the line tabs the panel starts 40px down: the Tabs gap (8px) plus
  // this padding. Narrower screens keep the 24px rules. The hideTabs branch
  // has no tabs, so it gets no offset.
  &__tabs &__tabs-content {
    @media screen and (width >= 768px) {
      padding-top: 32px;
    }
  }

  [data-slot='tabs-content'] {
    @media screen and (width < 768px) {
      padding-top: 24px;
    }
  }
}
</style>
