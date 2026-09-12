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

function focusMobilePanel(event: Event) {
  if (!(event.target instanceof HTMLElement)) return;
  // Start inside the dialog without selecting a profile action. Sheet retains
  // its focus trap and subsequent keyboard navigation between controls.
  event.preventDefault();
  event.target.focus({ preventScroll: true });
}
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
    @open-auto-focus="focusMobilePanel"
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
