import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import type { CarouselApi } from '@global-torque/ui-primitives/carousel';
import { useSyncWithUrl } from '@global-torque/ui-kit/url-sync';
import { mediaIndex, mediaKeys, type OfferMedia } from './offerMedia';

/** Gallery-local selection and carousel lifetime; callers key the gallery by offer ID. */
export function useOfferMediaGallery(files: Ref<readonly OfferMedia[]>, ready: Ref<boolean>) {
  // Keep the raw requested index until the public filer query settles. Reading it
  // must not change the first SSR/client slide or discard a delayed deep link.
  const requested = useSyncWithUrl({ key: 'media', defaultValue: '', adapter: 'history', navigationMode: 'replace' });
  const selected = ref(0);
  const selectionReady = ref(false);
  const initialAutoplay = ref(false);
  const keys = computed(() => mediaKeys(files.value));
  let api: CarouselApi;
  let mounted = false;
  let disposed = false;
  const reconciling = ref(false);
  let generation = 0;
  const selectedKey = ref<string>();
  let pendingRequest = true;
  let ownRequest: string | undefined;

  function writeSelection() {
    const value = selected.value === 0 ? '' : String(selected.value);
    if (requested.value !== value) {
      ownRequest = value;
      requested.value = value;
    }
  }
  function select(index: number) {
    if (!selectionReady.value || reconciling.value) return;
    initialAutoplay.value = false;
    selected.value = index;
    selectedKey.value = keys.value[index];
    api?.scrollTo(index);
    writeSelection();
  }
  function onSelect(instance: CarouselApi) {
    if (instance !== api || reconciling.value || !selectionReady.value) return;
    const index = instance?.selectedScrollSnap() || 0;
    if (index !== selected.value) {
      initialAutoplay.value = false;
      selected.value = index;
      selectedKey.value = keys.value[index];
      writeSelection();
    }
  }
  async function reconcile() {
    if (!mounted || disposed) return;
    const current = ++generation;
    reconciling.value = true;
    await nextTick();
    if (disposed || current !== generation) return;
    if (!ready.value) {
      if (selectionReady.value) {
        selected.value = Math.max(0, keys.value.indexOf(selectedKey.value || ''));
        api?.reInit();
        api?.scrollTo(selected.value, true);
      }
      reconciling.value = false;
      return;
    }
    const first = !selectionReady.value;
    const index = pendingRequest || first
      ? mediaIndex(requested.value, files.value.length)
      : Math.max(0, keys.value.indexOf(selectedKey.value || ''));
    selected.value = index;
    selectedKey.value = keys.value[index];
    pendingRequest = false;
    if (first) initialAutoplay.value = index === 0 && Boolean(files.value[0]?.video);
    // Explicit reinitialization sees the committed slides, and all intermediate
    // Embla selection events remain suppressed while the list is reconciled.
    api?.reInit();
    api?.scrollTo(index, true);
    selectionReady.value = true;
    writeSelection();
    reconciling.value = false;
  }
  function onReInit(instance: CarouselApi) {
    if (instance === api && !reconciling.value) void reconcile();
  }
  function detach() {
    api?.off('select', onSelect);
    api?.off('reInit', onReInit);
  }
  function setApi(instance: CarouselApi) {
    if (instance === api) return;
    detach();
    api = instance;
    api?.on('select', onSelect);
    api?.on('reInit', onReInit);
    void reconcile();
  }
  watch(requested, (value) => {
    if (value === ownRequest) {
      ownRequest = undefined;
      return;
    }
    ownRequest = undefined;
    pendingRequest = true;
    initialAutoplay.value = false;
    void reconcile();
  }, { flush: 'sync' });
  watch([keys, ready], () => {
    void reconcile();
  }, { flush: 'sync' });
  onMounted(() => {
    mounted = true;
    void reconcile();
  });
  onBeforeUnmount(() => {
    disposed = true;
    generation++;
    detach();
  });
  return { selectedKey, reconciling, selected, selectionReady, initialAutoplay, keys, select, setApi };
}
