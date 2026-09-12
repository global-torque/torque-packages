import { computed, onMounted, ref, watch, type Ref } from 'vue';
import { normalizeOfferVideo } from './offerMedia';

/** Provider poster requests belong to the feature, with one cancellable source lifetime. */
export function useOfferMediaVideo(source: Ref<string>) {
  const video = computed(() => normalizeOfferVideo(source.value));
  const poster = ref<string>();
  const mounted = ref(false);
  onMounted(() => {
    mounted.value = true;
  });
  watch([video, mounted], async ([current, isMounted], _, onCleanup) => {
    poster.value = current?.poster;
    if (!isMounted || current?.provider !== 'vimeo') return;
    const controller = new AbortController();
    let active = true;
    onCleanup(() => {
      active = false;
      controller.abort();
    });
    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(current.page)}`, { signal: controller.signal });
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (!active || !data || typeof data !== 'object' || !('thumbnail_url' in data) || typeof data.thumbnail_url !== 'string') return;
      const url = new URL(data.thumbnail_url);
      if (url.protocol === 'https:' && !url.username && !url.password) poster.value = url.href;
    }
    catch { /* A missing poster must never disable a valid player. */ }
  }, { immediate: true });
  return { video, poster };
}
