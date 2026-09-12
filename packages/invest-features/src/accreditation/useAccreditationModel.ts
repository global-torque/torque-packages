// @ts-nocheck
import type { IAccreditationData } from '@webdevelop-pro/domain-types/accreditationTypes';
import {
  createInvestDataApiClient,
  getInvestDataApiUrl,
} from '@webdevelop-pro/invest-data/service/dataClientConfig';
import { v4 as uuidv4 } from 'uuid';
import {
  applyOfflineHydrationMeta,
  createRepositoryStates,
  withActionState,
  type OptionsStateData,
} from '../modelState.ts';
import { withOfflineHydrationMeta } from '@webdevelop-pro/invest-data/repository';
import { acceptHMRUpdate, defineStore } from 'pinia';

type AccreditationStates = {
  getAllState: IAccreditationData[];
  createState: OptionsStateData;
  updateState: OptionsStateData;
  uploadDocumentState: OptionsStateData;
  createEscrowState: OptionsStateData;
};

export const useAccreditationModel = defineStore('feature-accreditation', () => {
  const accreditationUrl = getInvestDataApiUrl('accreditation');
  const apiClient = createInvestDataApiClient('accreditation');

  const {
    getAllState,
    createState,
    updateState,
    uploadDocumentState,
    createEscrowState,
    resetAll,
  } = createRepositoryStates<AccreditationStates>({
    getAllState: undefined,
    createState: undefined,
    updateState: undefined,
    uploadDocumentState: undefined,
    createEscrowState: undefined,
  });

  const getAll = async (profileId: number) => {
    let responseHeaders: Headers | null = null;
    const result = await withActionState(getAllState, async () => {
      const response = await apiClient.get(`/auth/accreditation/${profileId}`);
      responseHeaders = response.headers;
      return response.data;
    });
    if (responseHeaders) {
      getAllState.value = withOfflineHydrationMeta(getAllState.value, responseHeaders);
    }
    return result;
  };

  const create = async (profileId: number, note: string) =>
    withActionState(createState, async () => {
      const response = await apiClient.post(`/auth/accreditation/create/${profileId}`, {
        ai_method: 'upload',
        notes: note,
      });
      return response.data;
    });

  const update = async (profileId: number, note: string) =>
    withActionState(updateState, async () => {
      const response = await apiClient.post(`/auth/accreditation/update/${profileId}`, {
        ai_method: 'upload',
        notes: note,
        status: 'New Info Added',
      });
      return response.data;
    });

  const uploadDocument = async (userId: number, profileId: number, formData: FormData) =>
    withActionState(uploadDocumentState, async () => {
      const response = await apiClient.post(`/auth/accreditation/upload_document/${userId}/${profileId}`, formData, {
        headers: {
          'X-Request-ID': uuidv4() as string,
        },
        baseURL: accreditationUrl,
      });
      return response.data;
    });

  const createEscrow = async (userId: number, profileId: number) =>
    withActionState(createEscrowState, async () => {
      const response = await apiClient.post(`/auth/escrow/${userId}/${profileId}`, null, {
        headers: {
          'X-Request-ID': uuidv4(),
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
      });
      return response.data;
    });

  return {
    // States
    getAllState,
    createState,
    updateState,
    uploadDocumentState,
    createEscrowState,

    // Functions
    getAll,
    create,
    update,
    uploadDocument,
    createEscrow,
    resetAll,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAccreditationModel, import.meta.hot));
}
