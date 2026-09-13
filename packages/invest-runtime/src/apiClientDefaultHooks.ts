import { normalizeAnalyticsBodyForMethod } from '@global-torque/invest-core/analytics/analyticsBody';
import {
  PWA_OFFLINE_LAST_SYNC_HEADER,
  PWA_OFFLINE_RESPONSE_SOURCE_HEADER,
  persistOfflineResponse,
  readOfflineResponse,
  readOfflineResponseMetadata,
} from './pwa/pwaOfflineStore.ts';
import {
  matchOfflineDomainPolicy,
  type PwaPolicyEnv,
  type ResolvedOfflineDomainPolicy,
} from './pwa/pwaPolicy.ts';
import {
  configureApiClientHooks,
  createApiClientHooks,
  resetApiClientHooks,
  type ApiClientHooks,
  type ApiClientOfflinePolicy,
} from '@global-torque/invest-data/service/apiClientHooks';
import {
  createPwaPolicyEnvFromInvestAppConfig,
  getInvestRuntimePwaPolicyEnv,
} from './config.ts';
import { reportError } from './error/errorReporting.ts';

export type InstallDefaultApiClientHooksOptions = {
  pwaPolicyEnv?: PwaPolicyEnv;
  getPrivateCachePartition?: () => string | null | undefined;
};

export { createPwaPolicyEnvFromInvestAppConfig };

const toResolvedOfflineDomainPolicy = (
  policy: ApiClientOfflinePolicy,
) => policy as ResolvedOfflineDomainPolicy;

export function createDefaultApiClientHooks(
  options: InstallDefaultApiClientHooksOptions = {},
): ApiClientHooks {
  const getPwaPolicyEnv = () => (
    options.pwaPolicyEnv ?? getInvestRuntimePwaPolicyEnv()
  );
  const getCachePartition = (policy: ResolvedOfflineDomainPolicy) => (
    policy.scope === 'private' ? options.getPrivateCachePartition?.() ?? null : undefined
  );

  return createApiClientHooks({
    matchOfflinePolicy: (requestUrl, method) => (
      matchOfflineDomainPolicy(requestUrl, method, getPwaPolicyEnv())
    ),
    readOfflineResponse: (policy, requestUrl) => {
      const resolvedPolicy = toResolvedOfflineDomainPolicy(policy);
      const partition = getCachePartition(resolvedPolicy);
      if (resolvedPolicy.scope === 'private' && !partition) return Promise.resolve(null);
      return readOfflineResponse(resolvedPolicy, requestUrl, partition);
    },
    readOfflineResponseMetadata: (policy, requestUrl) => {
      const resolvedPolicy = toResolvedOfflineDomainPolicy(policy);
      const partition = getCachePartition(resolvedPolicy);
      if (resolvedPolicy.scope === 'private' && !partition) return Promise.resolve(null);
      return readOfflineResponseMetadata(resolvedPolicy, requestUrl, partition);
    },
    persistOfflineResponse: (policy, requestUrl, response) => {
      const resolvedPolicy = toResolvedOfflineDomainPolicy(policy);
      const partition = getCachePartition(resolvedPolicy);
      if (resolvedPolicy.scope === 'private' && !partition) return Promise.resolve();
      return persistOfflineResponse(resolvedPolicy, requestUrl, response, partition);
    },
    reportOfflinePolicyError: ({ phase, error }) => {
      reportError(error, `Offline response storage ${phase} failed`, {
        source: 'offline-response-storage',
        phase,
        silent: true,
      });
    },
    normalizeAnalyticsBodyForMethod,
    offlineResponseSourceHeader: PWA_OFFLINE_RESPONSE_SOURCE_HEADER,
    offlineLastSyncHeader: PWA_OFFLINE_LAST_SYNC_HEADER,
  });
}

export function installDefaultApiClientHooks(options: InstallDefaultApiClientHooksOptions = {}): void {
  resetApiClientHooks();
  configureApiClientHooks(createDefaultApiClientHooks(options));
}
