import type { ISession } from '@global-torque/domain-types/authTypes';
import type {
  IAuthFlow,
  ILogoutFlow,
} from '@global-torque/domain-types/settingsTypes';
import { createInvestDataApiClient } from './service/dataClientConfig.ts';

const getKratosClient = () => createInvestDataApiClient('kratos');

const requireResponseData = <T>(data: T | undefined, operation: string): T => {
  if (data === undefined) throw new Error(`Kratos ${operation} returned no data`);
  return data;
};

export async function fetchSettingsSessions(): Promise<ISession[]> {
  const client = getKratosClient();
  const response = await client.get<ISession[]>('/sessions');
  return requireResponseData(response.data, 'session list');
}

export async function deleteAllSettingsSessions(): Promise<unknown> {
  const client = getKratosClient();
  const response = await client.delete('/sessions');
  return response.data;
}

export async function deleteSettingsSession(id: string): Promise<string> {
  const client = getKratosClient();
  const response = await client.delete(
    `/sessions/${encodeURIComponent(id)}`,
    undefined,
    { type: 'text' },
  );
  return typeof response.data === 'string' && response.data
    ? response.data
    : 'Session deleted';
}

export async function fetchSettingsAuthFlow(
  url: string,
  query?: Record<string, string>,
): Promise<IAuthFlow | ILogoutFlow> {
  const client = getKratosClient();
  const response = await client.get<IAuthFlow | ILogoutFlow>(url, { params: query });
  return requireResponseData(response.data, 'settings auth flow');
}

export async function submitSettingsFlow(flowId: string, body: object): Promise<IAuthFlow> {
  const client = getKratosClient();
  const response = await client.post<IAuthFlow>(
    `/self-service/settings?flow=${encodeURIComponent(flowId)}`,
    body,
  );
  return requireResponseData(response.data, 'settings update');
}

export async function fetchSettingsFlow(flowId: string): Promise<IAuthFlow> {
  const client = getKratosClient();
  const response = await client.get<IAuthFlow>(
    `/self-service/settings/flows?id=${encodeURIComponent(flowId)}`,
  );
  return requireResponseData(response.data, 'settings flow');
}
