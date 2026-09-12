import {
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
} from 'vue';
import { isPwaStandalone } from './pwaDetector.ts';

const DISPLAY_MODE_MEDIA_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: window-controls-overlay)',
] as const;

export function usePwaStandalone() {
  const isStandalone = shallowRef(false);
  const mediaQueries: MediaQueryList[] = [];

  const syncStandaloneState = () => {
    isStandalone.value = isPwaStandalone();
  };

  onMounted(() => {
    syncStandaloneState();

    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('appinstalled', syncStandaloneState);

    if (!window.matchMedia) {
      return;
    }

    DISPLAY_MODE_MEDIA_QUERIES.forEach((query) => {
      const mediaQuery = window.matchMedia(query);

      mediaQuery.addEventListener?.('change', syncStandaloneState);
      mediaQueries.push(mediaQuery);
    });
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('appinstalled', syncStandaloneState);
    mediaQueries.forEach((mediaQuery) => {
      mediaQuery.removeEventListener?.('change', syncStandaloneState);
    });
  });

  return {
    isStandalone: computed(() => isStandalone.value),
  };
}
