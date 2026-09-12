<script setup lang="ts">
import { SidebarProvider } from '@global-torque/ui-primitives/sidebar';
import VSidebarTrigger from './VSidebarTrigger.vue';
import VAvatarIdentity from '../../VAvatarIdentity.vue';
import VHeaderAuthorized from '../../VHeaderBar/VHeaderAuthorized.vue';
import VHeaderGuest from '../../VHeaderBar/VHeaderGuest.vue';
import { computed, ref } from 'vue';
import Sidebar07Shell from './Sidebar07Shell.vue';
import type {
  Sidebar07Props, SidebarNavItem, SidebarTeam, SidebarUserAction,
} from '../types';

const props = withDefaults(defineProps<Sidebar07Props>(), {
  title: 'Workspace',
  subtitle: 'Sidebar block',
  mainNav: () => [],
  projects: () => [],
  user: null,
  collapsible: 'icon',
  side: 'left',
  defaultOpen: false,
  showHeaderOnMobile: true,
});

const emit = defineEmits<{
  select: [item: SidebarNavItem];
  teamSelect: [team: SidebarTeam];
  teamCreate: [];
  userAction: [action: SidebarUserAction];
}>();

const open = ref(props.defaultOpen);
const effectiveOpen = computed({
  get: () => props.collapsible === 'none' || open.value,
  set: (value: boolean) => { open.value = value; },
});
const isAuthorized = computed(() => Boolean(props.user));

</script>

<template>
  <SidebarProvider
    v-if="isAuthorized"
    v-model:open="effectiveOpen"
    :persist-state="false"
    :keyboard-shortcut="false"
    :style="{ '--sidebar-width': '18rem', '--sidebar-width-icon': '4.3rem', flexDirection: props.side === 'right' ? 'row-reverse' : undefined }"
    class="AppSidebar app-sidebar group/sidebar-wrapper flex min-h-screen w-full text-slate-950"
    :data-state="effectiveOpen ? 'expanded' : 'collapsed'"
    :data-collapsible="props.collapsible"
    :data-side="props.side"
  >
    <Sidebar07Shell
      v-bind="props"
      @select="emit('select', $event)"
      @team-create="emit('teamCreate')"
      @team-select="emit('teamSelect', $event)"
      @user-action="emit('userAction', $event)"
    >
      <template
        v-if="$slots.header"
        #header="slotProps"
      >
        <slot
          name="header"
          v-bind="slotProps"
        />
      </template>

      <template
        v-if="$slots['main-nav']"
        #main-nav="slotProps"
      >
        <slot
          name="main-nav"
          v-bind="slotProps"
        />
      </template>

      <template
        v-if="$slots.projects"
        #projects="slotProps"
      >
        <slot
          name="projects"
          v-bind="slotProps"
        />
      </template>

      <template
        v-if="$slots.footer"
        #footer="slotProps"
      >
        <slot
          name="footer"
          v-bind="slotProps"
        />
      </template>

      <template
        v-if="$slots['pre-footer']"
        #pre-footer="slotProps"
      >
        <slot
          name="pre-footer"
          v-bind="slotProps"
        />
      </template>

      <template
        v-if="$slots.user"
        #user="slotProps"
      >
        <slot
          name="user"
          v-bind="slotProps"
        />
      </template>

      <slot name="authorized-header">
        <VHeaderAuthorized
          :show-navigation="false"
          :show-mobile-sidebar="false"
          :user-logged-in="true"
        >
          <template #leading>
            <div
              v-if="props.user"
              class="is--lt-desktop-md-show"
            >
              <VSidebarTrigger
                v-slot="{ isMobile }"
                class="app-sidebar__mobile-trigger"
              >
                <VAvatarIdentity
                  v-if="isMobile"
                  size="small"
                  :src="props.user.avatarSrc"
                  alt="avatar image"
                  :avatar-text="props.user.avatarText"
                  :label="props.user.name"
                />
              </VSidebarTrigger>
            </div>
          </template>
        </VHeaderAuthorized>
      </slot>

      <div class="flex min-h-0 flex-1 flex-col pt-16">
        <slot />
      </div>
    </Sidebar07Shell>
  </SidebarProvider>

  <div
    v-else
    class="AppSidebar app-sidebar flex min-h-screen w-full flex-col bg-slate-100/70 text-slate-950"
  >
    <slot name="guest-header">
      <VHeaderGuest
        :show-navigation="false"
        :show-mobile-sidebar="false"
      />
    </slot>

    <main class="flex min-h-0 flex-1 flex-col pt-16">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.app-sidebar__mobile-trigger {
  max-width: min(220px, calc(100vw - 120px));
}
</style>
