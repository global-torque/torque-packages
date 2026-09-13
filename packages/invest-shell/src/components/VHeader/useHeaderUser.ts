import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import {
  computed, getCurrentScope, onScopeDispose, ref, watch,
} from 'vue';
import { storeToRefs } from 'pinia';
import { useSessionStore } from '@global-torque/invest-runtime/session';
import { getRequiredInvestRuntimeAdapter } from '@global-torque/invest-runtime/adapters';
import { useFilerModel } from '@global-torque/invest-runtime/filer';

export function useHeaderUser() {
  const sessionStore = useSessionStore();
  const { userSessionTraits } = storeToRefs(sessionStore as any) as any;

  const profilesRepository = getRequiredInvestRuntimeAdapter('profileRepository').getStore();
  const { getUserState } = storeToRefs(profilesRepository as any) as any;
  const { notificationFieldsState } = storeToRefs(useFilerModel() as any) as any;
  const avatarRevision = ref(0);
  const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
  const updateOnline = () => {
    isOnline.value = typeof navigator === 'undefined' ? true : navigator.onLine;
  };
  if (typeof window !== 'undefined' && getCurrentScope()) {
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    onScopeDispose(() => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    });
  }

  const userEmail = computed(() => userSessionTraits.value?.email);
  const sessionUserName = computed(() => {
    const first = userSessionTraits.value?.name?.first?.trim() || '';
    const last = userSessionTraits.value?.name?.last?.trim() || '';
    return `${first} ${last}`.trim();
  });
  const userDisplayName = computed(() => (
    getUserState.value.data?.fullName?.trim()
    || sessionUserName.value
    || userEmail.value
    || ''
  ));
  const imageID = computed<number | null | undefined>(
    () => getUserState.value.data?.image_link_id as number | null | undefined,
  );
  watch(
    () => notificationFieldsState.value.data,
    (fields) => {
      if (fields?.type !== 'file_thumbnail') return;
      const sourceFileId = Number(fields.source_file_id);
      if (Number.isSafeInteger(sourceFileId) && sourceFileId === Number(imageID.value)) {
        avatarRevision.value += 1;
      }
    },
  );

  const avatarSrc = computed<string | undefined>(() => {
    if (!isOnline.value) return undefined;
    const id = imageID.value;
    if (!id || id <= 0) {
      return undefined;
    }

    const filerUrl = useInvestApplicationContext().appConfig.urls.api.filer ?? '';
    return `${filerUrl}/auth/files/${id}?size=small&v=${avatarRevision.value}`;
  });

  return {
    userEmail,
    userDisplayName,
    imageID,
    isOnline,
    avatarSrc,
  };
}
