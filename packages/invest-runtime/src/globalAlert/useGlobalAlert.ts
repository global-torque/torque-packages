import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';

export type GlobalAlertVariant = 'error' | 'success' | 'info';

export const useGlobalAlert = defineStore('globalAlert', () => {
  const isVisible = ref(false);
  const variant = ref<GlobalAlertVariant>('error');
  const title = ref<string | null>(null);
  const message = ref<string | null>(null);

  const show = (options: {
    message: string;
    title?: string | null;
    variant?: GlobalAlertVariant;
  }) => {
    message.value = options.message;
    title.value = options.title ?? null;
    variant.value = options.variant ?? 'error';
    isVisible.value = true;
  };

  const hide = () => {
    isVisible.value = false;
  };

  return {
    isVisible,
    variant,
    title,
    message,
    show,
    hide,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGlobalAlert, import.meta.hot));
}

