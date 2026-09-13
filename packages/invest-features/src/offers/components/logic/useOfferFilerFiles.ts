import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import {
  computed, getCurrentScope, onScopeDispose, ref, watch, type Ref,
} from 'vue';
import { storeToRefs } from 'pinia';
import type { FilerAccess, IFilerItem } from '@global-torque/domain-types/filerTypes';
import type { IFilerItemFormatted } from '@global-torque/invest-core/filer/documentFormatter';
import type { IOfferFormatted } from '@global-torque/domain-types/offerTypes';
import { FilerFormatter, type FilerDocumentSource } from '@global-torque/invest-core/filer/documentFormatter';
import { useFilerModel } from '@global-torque/invest-runtime/filer';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { normalizeError, reportOfflineReadError } from '@global-torque/invest-runtime/error/errorReporting';

const collectMedia = (nodes: Record<string, IFilerItem>, inMedia = false): IFilerItem[] => (
  Object.entries(nodes).flatMap(([key, node]) => {
    const category = String(node['object-type'] ?? node['object-name'] ?? node.name ?? key)
      .trim().toLowerCase().replace(/_/g, '-');
    const isMedia = inMedia || category === 'media';
    const children = node.entities ? collectMedia(node.entities, isMedia) : [];
    const isFile = node.id !== undefined && (
      !node.entities
      || typeof node.filename === 'string'
      || typeof node.original_filename === 'string'
      || typeof node.mime === 'string'
      || node.type === 'file'
      || node.type === 'link'
    );
    return isMedia && isFile ? [node, ...children] : children;
  })
);

export function useOfferFilerFiles(offerRef: Ref<IOfferFormatted | undefined>) {
  const filerRepository = useFilerModel();
  const { objectInvalidationVersion } = storeToRefs(filerRepository);
  const { userLoggedIn } = storeToRefs(useSessionStore());
  const filerBaseUrl = (useInvestApplicationContext().appConfig.urls.api.filer ?? '').replace(/\/+$/, '');
  const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
  const updateOnline = () => {
    isOnline.value = typeof navigator === 'undefined' ? true : navigator.onLine;
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    if (getCurrentScope()) {
      onScopeDispose(() => {
        window.removeEventListener('online', updateOnline);
        window.removeEventListener('offline', updateOnline);
      });
    }
  }
  const offerId = computed(() => {
    const id = Number(offerRef.value?.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  });
  const publicState = computed(() => offerId.value === null
    ? null
    : filerRepository.getObjectQueryState('public', 'offer', offerId.value));
  const privateState = computed(() => offerId.value === null
    ? null
    : filerRepository.getObjectQueryState('private', 'offer', offerId.value));

  const load = async () => {
    if (offerId.value === null) return;
    const requestAccess: FilerAccess[] = ['public'];
    const requests = [
      filerRepository.fetchObjectTree({
        access: 'public',
        objectName: 'offer',
        objectId: offerId.value,
      }),
    ];
    if (userLoggedIn.value) {
      requestAccess.push('private');
      requests.push(filerRepository.fetchObjectTree({
        access: 'private',
        objectName: 'offer',
        objectId: offerId.value,
      }));
    }
    const results = await Promise.allSettled(requests);
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
        const isMissingPrivateTree = requestAccess[index] === 'private'
          && normalizeError(result.reason, 'Failed to load offer files').statusCode === 404;
        reportOfflineReadError(
          result.reason,
          'Failed to load offer files',
          isMissingPrivateTree ? { silent: true } : undefined,
        );
      }
    }
  };

  watch([offerId, userLoggedIn, objectInvalidationVersion], () => {
    if (typeof window !== 'undefined') {
      // Keep the first client render identical to SSR. The filer model marks a
      // request loading synchronously, so starting it inside setup changes the
      // skeleton branch before Vue has hydrated the server markup.
      queueMicrotask(() => void load());
    }
  }, { immediate: true });

  const sources = computed<FilerDocumentSource[]>(() => [
    { access: 'private', tree: userLoggedIn.value ? privateState.value?.data : null },
    { access: 'public', tree: publicState.value?.data },
  ]);
  const filesFormatted = computed<IFilerItemFormatted[]>(() => (
    FilerFormatter.getFormattedInvestmentDocuments(sources.value, filerBaseUrl)
  ));
  const folders = computed(() => FilerFormatter.getFolderedInvestmentDocuments(sources.value));
  const filesLoading = computed(() => Boolean(
    publicState.value?.loading || (userLoggedIn.value && privateState.value?.loading),
  ));
  const mediaReady = computed(() => offerId.value === null || Boolean(
    !publicState.value?.loading && (publicState.value?.data != null || publicState.value?.error != null),
  ));
  const publicMedia = computed(() => (
    publicState.value?.data ? collectMedia(publicState.value.data.entities) : []
  ));
  const mediaImages = computed(() => publicMedia.value.flatMap((item) => {
    const id = Number(item.id);
    return Number.isSafeInteger(id) && id > 0
      ? [{ image: `${filerBaseUrl}/public/files/${id}` }]
      : [];
  }));

  return { filesFormatted, folders, filesLoading, isOnline, mediaImages, mediaReady };
}
