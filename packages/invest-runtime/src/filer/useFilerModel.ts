import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  FilerAccess,
  FilerId,
  FilerNotificationFields,
  FilerObjectTree,
  FilerUploadResult,
} from '@global-torque/domain-types/filerTypes';
import {
  fetchMyObjectTree as requestMyObjectTree,
  fetchObjectTree as requestObjectTree,
  parseFilerNotificationFields,
  uploadFilerFile,
} from '@global-torque/invest-data/filer';
import type { ActionState } from '@global-torque/invest-data/repository';

export type FilerObjectQueryState = ActionState<FilerObjectTree>;

const createQueryState = (): FilerObjectQueryState => ({
  data: undefined,
  loading: false,
  error: null,
});

const createQueryKey = (access: FilerAccess, objectName: string, objectId: FilerId) => (
  `${access}:${objectName}:${String(objectId)}`
);

const isAbortError = (error: unknown, signal?: AbortSignal): boolean => (
  signal?.aborted === true
  || (error instanceof DOMException && error.name === 'AbortError')
  || (error instanceof Error && error.name === 'AbortError')
);

export const useFilerModel = defineStore('filer-model', () => {
  const objectQueries = ref<Record<string, FilerObjectQueryState>>({});
  const pendingQueries = new Map<string, Promise<FilerObjectTree>>();
  const queryVersions = new Map<string, number>();
  const objectInvalidationVersion = ref(0);
  const myObjectTreeState = ref<FilerObjectQueryState>(createQueryState());
  const isMyObjectTreeCacheValid = ref(false);
  const myObjectInvalidationVersion = ref(0);
  let pendingMyObjectTree: Promise<FilerObjectTree> | null = null;
  let myObjectTreeGeneration = 0;
  const notificationFieldsState = ref<ActionState<FilerNotificationFields>>({
    data: undefined,
    loading: false,
    error: null,
  });
  const getObjectQueryState = (
    access: FilerAccess,
    objectName: string,
    objectId: FilerId,
  ): FilerObjectQueryState => {
    const key = createQueryKey(access, objectName, objectId);
    if (!objectQueries.value[key]) objectQueries.value[key] = createQueryState();
    return objectQueries.value[key];
  };

  const fetchObjectTree = async (options: {
    access: FilerAccess;
    objectId: FilerId;
    objectName: string;
    signal?: AbortSignal;
    force?: boolean;
  }): Promise<FilerObjectTree> => {
    const key = createQueryKey(options.access, options.objectName, options.objectId);
    const state = getObjectQueryState(options.access, options.objectName, options.objectId);
    if (!options.force && state.data) return state.data;
    const pending = pendingQueries.get(key);
    if (!options.force && !options.signal && pending) return pending;
    const requestVersion = (queryVersions.get(key) ?? 0) + 1;
    queryVersions.set(key, requestVersion);
    state.loading = true;
    state.error = null;
    const request = (async () => {
      try {
        const tree = await requestObjectTree(options);
        if (queryVersions.get(key) === requestVersion) state.data = tree;
        return tree;
      } catch (error) {
        if (queryVersions.get(key) === requestVersion) {
          state.error = error instanceof Error ? error : new Error(String(error));
          state.data = undefined;
        }
        throw error;
      } finally {
        if (queryVersions.get(key) === requestVersion) {
          state.loading = false;
          pendingQueries.delete(key);
        }
      }
    })();
    pendingQueries.set(key, request);
    return request;
  };

  const fetchMyObjectTree = async (options: { signal?: AbortSignal; force?: boolean } = {}) => {
    const state = myObjectTreeState.value;
    if (!options.force && isMyObjectTreeCacheValid.value && state.data !== undefined) {
      return state.data;
    }
    if (!options.force && !options.signal && pendingMyObjectTree) return pendingMyObjectTree;

    const requestGeneration = ++myObjectTreeGeneration;
    isMyObjectTreeCacheValid.value = false;
    state.loading = true;
    state.error = null;
    const request = (async () => {
      try {
        const tree = await requestMyObjectTree({ signal: options.signal });
        if (myObjectTreeGeneration === requestGeneration) {
          state.data = tree;
          state.error = null;
          isMyObjectTreeCacheValid.value = true;
        }
        return tree;
      }
      catch (error) {
        if (myObjectTreeGeneration === requestGeneration && !isAbortError(error, options.signal)) {
          state.error = error instanceof Error ? error : new Error(String(error));
        }
        throw error;
      }
      finally {
        if (myObjectTreeGeneration === requestGeneration) {
          state.loading = false;
          pendingMyObjectTree = null;
        }
      }
    })();
    pendingMyObjectTree = request;
    return request;
  };

  const uploadFile = (
    file: File,
    options: {
      objectId: FilerId;
      objectName: string;
      userId: number;
      signal?: AbortSignal;
    },
  ): Promise<FilerUploadResult> => uploadFilerFile(file, options);

  const invalidateObjectTree = (access: FilerAccess, objectName: string, objectId: FilerId) => {
    const key = createQueryKey(access, objectName, objectId);
    queryVersions.set(key, (queryVersions.get(key) ?? 0) + 1);
    pendingQueries.delete(key);
    delete objectQueries.value[key];
    objectInvalidationVersion.value += 1;
  };

  const resetObjectQueries = () => {
    const keys = new Set([
      ...queryVersions.keys(),
      ...pendingQueries.keys(),
      ...Object.keys(objectQueries.value),
    ]);
    for (const key of keys) queryVersions.set(key, (queryVersions.get(key) ?? 0) + 1);
    pendingQueries.clear();
    objectQueries.value = {};
    objectInvalidationVersion.value += 1;
  };

  const invalidateMyObjectTree = () => {
    myObjectTreeGeneration += 1;
    pendingMyObjectTree = null;
    myObjectTreeState.value.loading = false;
    isMyObjectTreeCacheValid.value = false;
    myObjectInvalidationVersion.value += 1;
  };

  const updateNotificationData = (notification: unknown) => {
    const fields = parseFilerNotificationFields(notification);
    if (!fields) return;
    notificationFieldsState.value = {
      data: fields,
      loading: false,
      error: null,
    };

    if (fields.object_id !== undefined || fields.source_file_id !== undefined) {
      resetObjectQueries();
      invalidateMyObjectTree();
    }
  };

  const resetAll = () => {
    resetObjectQueries();
    myObjectTreeGeneration += 1;
    pendingMyObjectTree = null;
    myObjectTreeState.value = createQueryState();
    isMyObjectTreeCacheValid.value = false;
    myObjectInvalidationVersion.value += 1;
    notificationFieldsState.value = {
      data: undefined,
      loading: false,
      error: null,
    };
  };

  return {
    objectQueries,
    objectInvalidationVersion,
    myObjectTreeState,
    isMyObjectTreeCacheValid,
    myObjectInvalidationVersion,
    fetchMyObjectTree,
    notificationFieldsState,
    fetchObjectTree,
    getObjectQueryState,
    invalidateObjectTree,
    resetObjectQueries,
    resetAll,
    updateNotificationData,
    uploadFile,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFilerModel, import.meta.hot));
}
