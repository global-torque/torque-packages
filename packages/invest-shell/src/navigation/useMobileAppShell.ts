import { computed, onMounted, shallowRef } from 'vue';

import { isPwaMobile } from '@webdevelop-pro/invest-runtime/pwa/pwaDetector';
import { useBreakpoints } from '@global-torque/ui-kit/breakpoints';

export function useMobileAppShell() {
  const { isTablet } = useBreakpoints();
  const isClientReady = shallowRef(false);

  onMounted(() => {
    isClientReady.value = true;
  });

  const usesMobileAppShell = computed(() => {
    if (!isClientReady.value) {
      return false;
    }

    return isPwaMobile() || isTablet.value;
  });

  return {
    usesMobileAppShell,
  };
}
