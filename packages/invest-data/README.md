# Invest Data

Framework-free investment data package for API clients, service contracts,
API-error normalization, endpoint client factories, and pure repository state
helpers.

## Ownership

- Legacy `ApiClient`, API hook configuration, API errors, and service request
  types.
- API/network error classes that carry selectively sanitized request metadata
  for the frontend reporting pipeline. Known credential headers, URL fields,
  and body fields are redacted while useful request context is retained.
- SDK-read compatibility error projection that preserves bounded protocol
  response bodies, plus narrowly normalized, revalidated offer list/detail
  responses during the backend deployment transition.
- An SDK Vault-resource compatibility facade that preserves the legacy
  `ApiClient` hooks and domain return shapes for position and redemption calls.
- Explicit data-client config for API base URLs, scanner URLs, app links,
  debug flags, and third-party data adapter keys.
- Framework-free endpoint factories such as the EVM wallet repository and
  ERC-7540 Vault lifecycle clients.
- A validated redemption lifecycle client with explicit network versus
  offline-cache source metadata and last-synced timestamps.
- Pure `ActionState` shapes and state-transition helpers.

Vue/Pinia repository wrappers live in their owning app or bounded feature. This
package exposes only framework-free clients and repository-state helpers.

## Allowed Dependencies

- `@global-torque/domain-types` for DTO and analytics contracts.
- `@global-torque/invest-core` for pure config/link contracts and helpers.
- Browser fetch/Headers/Response types and injected runtime hooks.

## Forbidden Dependencies

- Vue, Pinia, Vue Router, route-level views, UI packages, apps, or
  `invest-common`.
- `invest-runtime` or any runtime package that would create a data/runtime
  cycle.
- Direct `import.meta.env` reads. Apps/runtime install data config explicitly.

## Public Exports

- `.`: root barrel for the HTTP client, legacy `ApiClient`, EVM repository
  factory, data-client config helpers, API hooks, API errors, service types,
  and pure repository state helpers.
- `./client`: framework-free fetch client.
- `./api-client` and `./service/apiClient`: legacy `ApiClient`.
- `./service/apiClientHooks`: hook configuration used by runtime installers.
- `./service/dataClientConfig`: explicit data-client config and client factory
  helpers.
- `./service/handlers/apiError` and
  `./service/handlers/offlineRequestError`: API error classes.
- `./service/handlers/networkRequestError`: raw fetch/network failure wrapper
  with `data.httpRequest`, `statusCode: 0`, retry metadata, and body metadata
  normalized through the shared analytics policy.
- `./service/types`: legacy service request/response types.
- `./repository`: pure `ActionState` and state-transition helpers.
- `./migration/sdkReadCompatibility`: SDK-read error projection plus narrowly
  scoped deployed-offer normalization for exact decimal strings and temporary
  `close_at` validation exclusion, backed by the pinned SDK validator for all
  other fields.
- `./evm` and `./investDataClient`: EVM endpoint repository factories.
- `./redemptions`: validated, offline-aware redemption lifecycle client and
  typed lifecycle result.
- `./vault`: exact-string investment/redemption intent, investor
  prepare/status, lifecycle access, and fund-manager fulfillment/signing
  payload client.

## Example

```ts
import {
  createInvestDataApiClient,
  setInvestDataClientConfig,
} from '@global-torque/invest-data/service/dataClientConfig';

setInvestDataClientConfig({
  apiUrls: {
    wallet: 'https://wallet.example.test',
  },
});

const walletClient = createInvestDataApiClient('wallet');
const wallet = await walletClient.get('/auth/wallet/1150');
```

Both the legacy `ApiClient` and the hook-based `createInvestDataClient` keep
the package framework-free while preserving failed request context. HTTP
failures expose method, URL, path, status, and selectively redacted body metadata;
raw fetch failures are wrapped as `NetworkRequestError` unless the request was
aborted.
