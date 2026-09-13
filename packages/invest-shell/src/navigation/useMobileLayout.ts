import { onBeforeUnmount, onMounted, watch } from 'vue';
import { installPwaNoZoomGuards } from '@global-torque/invest-runtime/pwa/disableZoom';
import { isPwaMobile } from '@global-torque/invest-runtime/pwa/pwaDetector';
import { useMobileAppShell } from './useMobileAppShell.ts';

type UseMobileLayoutOptions = {
  shellClassNames?: string[];
};

export function useMobileLayout(options: UseMobileLayoutOptions = {}) {
  const {
    shellClassNames = ['mobile-app-shell', 'pwa-mobile'],
  } = options;

  const { usesMobileAppShell } = useMobileAppShell();

  let removeNoZoomGuards: (() => void) | undefined;

  const syncShellClassName = (enabled: boolean) => {
    if (typeof document === 'undefined') {
      return;
    }

    shellClassNames.forEach((className) => {
      document.body.classList.toggle(className, enabled);
      document.documentElement.classList.toggle(className, enabled);
    });
  };

  onMounted(() => {
    if (isPwaMobile()) {
      removeNoZoomGuards = installPwaNoZoomGuards();
    }
  });

  onBeforeUnmount(() => {
    removeNoZoomGuards?.();
    removeNoZoomGuards = undefined;

    syncShellClassName(false);
  });

  watch(
    usesMobileAppShell,
    (usesMobileShell) => {
      syncShellClassName(usesMobileShell);
    },
    { immediate: true },
  );

  return {
    usesMobileShell: usesMobileAppShell,
  };
}
