<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@global-torque/ui-primitives/sidebar';
import { computed } from 'vue';
import NavMain from './NavMain.vue';
import NavProjects from './NavProjects.vue';
import NavUser from './NavUser.vue';
import TeamSwitcher from './TeamSwitcher.vue';
import type {
  Sidebar07Props, SidebarNavItem, SidebarTeam, SidebarUserAction,
} from '../types';

const props = withDefaults(defineProps<Sidebar07Props>(), {
  title: 'Workspace',
  subtitle: 'Sidebar block',
  mainNav: () => [],
  projects: () => [],
  teams: () => [],
  user: null,
  showHeaderOnMobile: true,
});

const emit = defineEmits<{
  select: [item: SidebarNavItem];
  teamSelect: [team: SidebarTeam];
  teamCreate: [];
  userAction: [action: SidebarUserAction];
}>();

const sidebar = useSidebar();
// The investor host keeps noncollapsible navigation fixed on desktop and
// dismissible on mobile. Its controlled provider keeps desktop state expanded.
const primitiveCollapsible = computed(() => props.collapsible === 'none' ? 'offcanvas' : props.collapsible);
const isCollapsed = computed(() => !sidebar.isMobile.value && sidebar.state.value === 'collapsed');
const showSidebarHeader = computed(() => (
  !sidebar.isMobile.value || props.showHeaderOnMobile
));
</script>

<template>
  <!-- Preserve the closed panel's decoration without mounting Sheet content. -->
  <div
    v-if="sidebar.isMobile.value && !sidebar.openMobile.value"
    class="sidebar-07-closed-shadow"
    :data-side="props.side ?? 'left'"
    aria-hidden="true"
  />
  <Sidebar
    :side="props.side"
    :collapsible="primitiveCollapsible"
    class="Sidebar07Shell sidebar-07-shell"
    :class="{ 'is--desktop-collapsed': sidebar.state.value === 'collapsed' }"
  >
    <SidebarHeader v-if="showSidebarHeader">
      <slot
        name="header"
        :collapsed="isCollapsed"
      >
        <TeamSwitcher
          :dropdown-component="props.teamDropdownComponent"
          :dropdown-props="props.teamDropdownProps"
          :teams="props.teams"
          :title="props.title"
          :subtitle="props.subtitle"
          @create="emit('teamCreate')"
          @select="emit('teamSelect', $event)"
        />
      </slot>
    </SidebarHeader>

    <SidebarContent>
      <slot
        name="main-nav"
        :collapsed="isCollapsed"
        :items="props.mainNav"
      >
        <NavMain
          :items="props.mainNav"
          @select="$emit('select', $event)"
        />
      </slot>

      <slot
        name="projects"
        :collapsed="isCollapsed"
        :items="props.projects"
      >
        <NavProjects
          :items="props.projects"
          @select="$emit('select', $event)"
        />
      </slot>
    </SidebarContent>

    <slot
      name="pre-footer"
      :collapsed="isCollapsed"
    />

    <SidebarFooter>
      <slot
        name="footer"
        :collapsed="isCollapsed"
      />
      <slot
        name="user"
        :collapsed="isCollapsed"
        :user="props.user"
      >
        <NavUser
          :user="props.user"
          @action="emit('userAction', $event)"
        />
      </slot>
    </SidebarFooter>
    <SidebarRail
      v-if="!sidebar.isMobile.value"
      tabindex="0"
      aria-label="Toggle sidebar"
      class="sidebar-07-rail"
    />
  </Sidebar>

  <div class="sidebar-07-inset relative flex min-h-screen w-full flex-1 flex-col bg-transparent">
    <slot />
  </div>
</template>

<style scoped>
/* Sidebar07 owns investor navigation geometry; generic Sidebar defaults stay
   neutral. Both brands retain the former shell's 18rem/4.3rem dimensions.
   The primitive Sidebar puts the shell class on its inner container, so the
   rules reach it through :deep(). The mobile Sheet renders without the class
   and keeps the primitive look. */
:deep(.sidebar-07-shell) {
  z-index: 30;
  overflow: hidden;
  background: color-mix(in oklab, var(--background) 90%, transparent);
  border-color: var(--sidebar-border);
  backdrop-filter: blur(8px);
}
:deep(.sidebar-07-shell > [data-sidebar='sidebar']) { background: transparent; min-height: 0; overflow: hidden; }
.sidebar-07-closed-shadow {
  backdrop-filter: none;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 43;
  width: 18rem;
  max-width: calc(100vw - 10px);
  height: 100svh;
  transform: translateX(-100%);
  will-change: transform;
  pointer-events: none;
  box-shadow: var(--shadow-2xl);
}
.sidebar-07-closed-shadow[data-side='right'] { left: auto; right: 0; transform: translateX(100%); }
:deep(.sidebar-07-shell [data-slot='sidebar-header']),
:deep(.sidebar-07-shell [data-slot='sidebar-footer']) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-color: var(--sidebar-border);
}
:deep(.sidebar-07-shell [data-slot='sidebar-header']) { border-bottom-width: 1px; }
:deep(.sidebar-07-shell [data-slot='sidebar-footer']) { margin-top: auto; border-top-width: 1px; }
:deep(.sidebar-07-shell [data-slot='sidebar-content']) { gap: 16px; overflow-y: auto; padding: 16px 12px; }
:deep(.sidebar-07-shell [data-slot='sidebar-group']) { position: static; gap: 8px; padding: 0; }
:deep(.sidebar-07-shell [data-slot='sidebar-group-content']) { display: flex; flex-direction: column; gap: 4px; }
:deep(.sidebar-07-shell [data-slot='sidebar-group-label']) {
  display: block;
  height: auto;
  padding: 0 8px;
  font-size: 11px;
  line-height: inherit;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--foreground);
}
:deep(.sidebar-07-shell [data-slot='sidebar-menu']) { list-style: none; padding: 0; gap: 4px; }
:deep(.sidebar-07-shell [data-slot='sidebar-menu-item']) { position: static; list-style: none; }
/* :where() keeps this base rule below the triggers' own open and collapsed
   states in TeamSwitcher and NavUser, which load before this block. */
:deep(:where(.sidebar-07-shell [data-sidebar='menu-button'])) {
  overflow: visible;
  height: 40px;
  padding: 0 16px;
  gap: 12px;
  border-radius: 2px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 21px;
  font-weight: 700;
  text-decoration: none !important;
}
:deep(.sidebar-07-shell [data-sidebar='menu-button'][data-slot='dropdown-menu-trigger']) { border-width: 0px; }
:deep(.sidebar-07-shell :is(.team-switcher__trigger, .nav-user__trigger)[data-sidebar='menu-button']) { gap: 12px; }
:deep(.sidebar-07-shell [data-sidebar='menu-button'][data-size='sm']) { height: 32px; padding-inline: 12px; font-size: 12px; line-height: 16px; }
:deep(.sidebar-07-shell [data-sidebar='menu-button']:hover) { background: var(--muted); color: var(--foreground); }
:deep(.sidebar-07-shell [data-sidebar='menu-button'][data-active='true']) { background: var(--accent); color: var(--accent-foreground); border-color: transparent; box-shadow: none; }
:deep(.sidebar-07-shell [data-sidebar='menu-button'][data-active='true']:hover) { background: color-mix(in srgb, var(--accent) 80%, transparent); color: var(--accent-foreground); }
.app-sidebar [data-state='collapsed'] :deep(.sidebar-07-shell [data-sidebar='menu-button']) {
  width: 40px !important;
  height: 40px !important;
  padding: 0 !important;
  justify-content: center;
}
.app-sidebar [data-state='collapsed'] :deep(.sidebar-07-shell :is(.nav-main__button, .nav-projects [data-sidebar='menu-button'])) { justify-content: flex-start; }
:deep(.sidebar-07-shell [data-sidebar='menu-button'] svg:where(:not([class*='size-']):not(.team-switcher__chevron):not(.nav-user__chevron))) { width: 16px; height: 16px; }
.app-sidebar [data-state='collapsed'] :deep(.sidebar-07-shell [data-sidebar='menu-button'] svg) { width: 18px; height: 18px; }
:deep(.sidebar-07-shell .sidebar-07-rail) {
  position: absolute;
  inset-block: 0;
  left: auto;
  right: 0;
  width: 6px;
  transform: none;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
}
:deep(.sidebar-07-shell .sidebar-07-rail::after) { display: none; }
.app-sidebar[data-side='right'] .sidebar-07-rail { left: 0; right: auto; }
:deep(.sidebar-07-shell .sidebar-07-rail:hover),
:deep(.sidebar-07-shell .sidebar-07-rail:focus-visible) { background: rgb(from var(--sidebar-border) r g b / 70%); outline: none; }
.sidebar-07-inset { min-width: 0; }
</style>
