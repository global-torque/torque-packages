import { ref, watch } from 'vue';
import { acceptHMRUpdate, defineStore } from 'pinia';

export const useDialogs = defineStore('dialogs', () => {
  const isDialogLogoutOpen = ref(false);
  const isDialogRefreshSessionOpen = ref(false);
  const isDialogContactUsOpen = ref(false);
  const isDialogWalletAuthOpen = ref(false);
  const dialogContactUsSubject = ref<string | null>(null);
  
  // Promise resolver for session refresh completion
  const sessionRefreshResolver = ref<((value: boolean) => void) | null>(null);
  
  const showRefreshSession = (): Promise<boolean> => {
    isDialogRefreshSessionOpen.value = true;
    
    return new Promise<boolean>((resolve) => {
      sessionRefreshResolver.value = resolve;
    });
  };

  const completeSessionRefresh = (success: boolean = true) => {
    if (sessionRefreshResolver.value) {
      sessionRefreshResolver.value(success);
      sessionRefreshResolver.value = null;
    }
    isDialogRefreshSessionOpen.value = false;
  };

  const openContactUsDialog = (subject?: string) => {
    dialogContactUsSubject.value = subject ?? null;
    isDialogContactUsOpen.value = true;
  };

  const closeContactUsDialog = () => {
    isDialogContactUsOpen.value = false;
    dialogContactUsSubject.value = null;
  };

  const openWalletAuthDialog = () => {
    isDialogWalletAuthOpen.value = true;
  };

  const closeWalletAuthDialog = () => {
    isDialogWalletAuthOpen.value = false;
  };

  watch(isDialogContactUsOpen, (isOpen) => {
    if (!isOpen) {
      dialogContactUsSubject.value = null;
    }
  });

  return {
    isDialogLogoutOpen,
    isDialogRefreshSessionOpen,
    isDialogContactUsOpen,
    isDialogWalletAuthOpen,
    dialogContactUsSubject,
    showRefreshSession,
    completeSessionRefresh,
    openContactUsDialog,
    closeContactUsDialog,
    openWalletAuthDialog,
    closeWalletAuthDialog,
  };
});

// Avoid registering Pinia HMR handlers inside Vitest workers.
// The extra accept hook can outlive the module runner during teardown
// and trigger "Closing rpc while fetch was pending" crashes.
const isVitestRuntime = Boolean((import.meta as ImportMeta & {
  readonly vitest?: unknown;
}).vitest);

if (import.meta.hot && import.meta.env.MODE !== 'test' && !isVitestRuntime) {
  import.meta.hot.accept(acceptHMRUpdate(useDialogs, import.meta.hot));
}
