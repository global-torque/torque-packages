import { APIError } from '@global-torque/invest-data/service/handlers/apiError';
import type { ApiResponse } from '@global-torque/invest-data/service/types';
import { useInvestApplicationContext } from '@global-torque/invest-runtime/application-context';
import { createActionState, withActionState } from '../../modelState.ts';
import { computed } from 'vue';
import {
  ISession, IAuthFlow, ILogoutFlow, ISchema, ISuccessfullNativeAuth,
} from '@global-torque/domain-types/authTypes';

// https://github.com/ory/kratos-selfservice-ui-react-nextjs/blob/master/pages/login.tsx

export const useRepositoryAuth = () => {
  const apiClient = useInvestApplicationContext().createApiClient('kratos');

  // Create action states for each function
  const getSessionState = createActionState<ISession>();
  const getAuthFlowState = createActionState<IAuthFlow | ILogoutFlow>();
  const getSchemaState = createActionState<ISchema>();

  const getLogoutState = createActionState<ApiResponse<unknown>>();

  const setRecoveryState = createActionState<IAuthFlow>();

  const getLoginState = createActionState<IAuthFlow>();
  const setLoginState = createActionState<ISuccessfullNativeAuth>();

  const getSignupState = createActionState<IAuthFlow>();
  const setSignupState = createActionState<ISuccessfullNativeAuth>();

  const getSession = async (): Promise<ISession | null> => {
    try {
      const result = await withActionState(getSessionState, async () => {
        const response = await apiClient.get<ISession>('/sessions/whoami');
        return response.data;
      });
      return result ?? null;
    } catch (err) {
      if (err instanceof APIError && err.data.statusCode === 401) {
        getSessionState.value.data = undefined;
        getSessionState.value.error = null;
        return null;
      }
      throw err;
    }
  };

  const getAuthFlow = async (url: string, query?: Record<string, string>) =>
    withActionState(getAuthFlowState, async () => {
      const response = await apiClient.get(url, { params: query });
      return response.data;
    });

  const setLogin = async (flowId: string, body: object) =>
    withActionState(setLoginState, async () => {
      const response = await apiClient.post(`/self-service/login?flow=${flowId}`, body);
      return response.data;
    });

  const getLogin = async (flowId: string) =>
    withActionState(getLoginState, async () => {
      const response = await apiClient.get(`/self-service/login/flows?id=${flowId}`);
      return response.data;
    });

  const getLogout = async (token: string) =>
    withActionState(getLogoutState, async () => {
      const response = await apiClient.get(`/self-service/logout?token=${token}`);
      return response;
    });

  const getSignup = async (flowId: string) =>
    withActionState(getSignupState, async () => {
      const response = await apiClient.get(`/self-service/registration/flows?id=${flowId}`);
      return response.data;
    });

  const setSignup = async (flowId: string, body: object) =>
    withActionState(setSignupState, async () => {
      const response = await apiClient.post(`/self-service/registration?flow=${flowId}`, body);
      return response.data;
    });

  const setRecovery = async (flowId: string, body: object) =>
    withActionState(setRecoveryState, async () => {
      const response = await apiClient.post(`/self-service/recovery?flow=${flowId}`, body);
      return response.data;
    });

  const getSchema = async () =>
    withActionState(getSchemaState, async () => {
      const response = await apiClient.get('/schemas');
      return response.data;
    });

  const flowId = computed(() => (getAuthFlowState.value.data as IAuthFlow | undefined)?.id ?? '');

  const csrfToken = computed(() => {
    const data = getAuthFlowState.value.data as IAuthFlow | undefined;
    const res = data?.ui;
    if (res) {
      const tokenItem = res.nodes.find((item: { attributes: { name: string; }; }) => (
        item.attributes.name === 'csrf_token'));
      return tokenItem?.attributes.value ?? '';
    }
    return '';
  });

  const resetAll = () => {
    getSessionState.value = { loading: false, error: null, data: undefined };
    getAuthFlowState.value = { loading: false, error: null, data: undefined };
    setRecoveryState.value = { loading: false, error: null, data: undefined };
    setLoginState.value = { loading: false, error: null, data: undefined };
    setSignupState.value = { loading: false, error: null, data: undefined };
    getSignupState.value = { loading: false, error: null, data: undefined };
    getSchemaState.value = { loading: false, error: null, data: undefined };
    getLoginState.value = { loading: false, error: null, data: undefined };
    getLogoutState.value = { loading: false, error: null, data: undefined };
  };

  return {
    // States
    getSessionState,
    getAuthFlowState,
    setRecoveryState,
    setLoginState,
    setSignupState,
    getSignupState,
    getSchemaState,
    getLoginState,
    getLogoutState,
    flowId,
    csrfToken,

    // Functions
    getSession,
    getAuthFlow,
    setLogin,
    getLogin,
    getLogout,
    setSignup,
    setRecovery,
    getSignup,
    getSchema,
    resetAll,
  };
};
