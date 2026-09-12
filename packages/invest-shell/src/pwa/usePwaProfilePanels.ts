import { onScopeDispose, ref, watch } from 'vue';

const PROFILE_OVERLAY_BODY_CLASS = 'pwa-profile-overlay-open';
const PROFILE_SWITCH_SIDEBAR_BODY_CLASS = 'pwa-profile-switch-sidebar-open';

const toggleBodyClass = (className: string, enabled: boolean) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.body?.classList.toggle(className, enabled);
};

export function usePwaProfilePanels() {
  const isProfileOverlayOpen = ref(false);
  const isProfileSwitchSidebarOpen = ref(false);

  const closeProfileOverlay = () => {
    isProfileOverlayOpen.value = false;
  };

  const closeProfileSwitchSidebar = () => {
    isProfileSwitchSidebarOpen.value = false;
  };

  const openProfileOverlay = () => {
    closeProfileSwitchSidebar();
    isProfileOverlayOpen.value = true;
  };

  const openProfileSwitchSidebar = () => {
    closeProfileOverlay();
    isProfileSwitchSidebarOpen.value = true;
  };

  watch(isProfileOverlayOpen, (enabled) => {
    toggleBodyClass(PROFILE_OVERLAY_BODY_CLASS, enabled);
  }, { immediate: true });

  watch(isProfileSwitchSidebarOpen, (enabled) => {
    toggleBodyClass(PROFILE_SWITCH_SIDEBAR_BODY_CLASS, enabled);
  }, { immediate: true });

  onScopeDispose(() => {
    toggleBodyClass(PROFILE_OVERLAY_BODY_CLASS, false);
    toggleBodyClass(PROFILE_SWITCH_SIDEBAR_BODY_CLASS, false);
  });

  return {
    isProfileOverlayOpen,
    isProfileSwitchSidebarOpen,
    openProfileOverlay,
    closeProfileOverlay,
    openProfileSwitchSidebar,
    closeProfileSwitchSidebar,
  };
}
