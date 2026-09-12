import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';

export const useGlobalLoader = defineStore('globalLoader', () => {
  const isLoading = ref(false);

  const show = () => {
    isLoading.value = true;
  };

  const hide = () => {
    isLoading.value = false;
  };

  const toggle = (value = !isLoading.value) => {
    isLoading.value = value;
  };

  return {
    isLoading,
    show,
    hide,
    toggle,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGlobalLoader, import.meta.hot));
}
