# @global-torque/domain-types

Pure investment-domain TypeScript contracts shared by apps and packages.

## Ownership

This package owns DTOs, status constants, request/response shapes, and data-shape contracts that are safe to consume from any TypeScript runtime.

## Allowed Dependencies

- TypeScript standard library types.
- Other pure type packages, after dependency direction is reviewed.

## Forbidden Dependencies

- Vue, Pinia, Vue Router, or browser-only globals.
- `import.meta.env` or application runtime config.
- `@global-torque/ui-kit`, `@global-torque/ui-primitives`, or investment runtime/data packages.
- App route names unless they are explicitly accepted as cross-app contracts.

## Public Exports

- `accreditationTypes`: accreditation status constants and raw accreditation response shapes.
- `analyticsTypes`: analytics DTOs, log levels, client contracts, frontend
  service labels, and client error context shapes.
- `authConstants`: Ory self-service API endpoint path constants and AAL2 query contract.
- `authTypes`: Ory session, flow, logout, native auth, schema, and error DTOs;
  identity traits allow flat `first_name`/`last_name` and optional nested `name`.
- `blogTypes`: public invest content metadata contracts and reviewed content-link slug constants.
- `distributionsTypes`: distribution response and formatted distribution contracts.
- `esignTypes`: e-signature request/response contracts.
- `evmTypes`: EVM wallet, transaction, authorization, withdraw, exchange, and Earn-overlay contracts.
- `filerTypes`: filer item and sign-url response contracts.
- `investmentTypes`: investment status constants, request/response shapes, document contracts, and formatted investment contracts.
- `kycTypes`: KYC status constants and raw KYC response/launch contracts.
- `notificationsTypes`: notification payload, token, data-field, and formatted notification contracts.
- `offerTypes`: offer status constants, offer response/comment payload contracts, and formatted offer contracts.
- `profilesTypes`: profile/user/background-information request and response contracts.
- `profileTypes`: stable investment profile type constants and unions.
- `redemptionDigest`: Canonical JSON Grammar v1 encoding, SHA-256 helpers, and
  the typed `CanonicalJsonError` validation contract.
- `settingsTypes`: session activity and formatted session contracts.
- `walletTypes`: custodial wallet status constants, funding-source, wallet, transaction, and Plaid response contracts.
- `vaultTypes`: ERC-7540 deployment, position, redemption, signing, operation,
  and fund-manager fulfillment contracts with exact raw-string amounts.

## Example

```ts
import { PROFILE_TYPES, type ProfileType } from '@global-torque/domain-types';
import { AnalyticsLogLevel, type IAnalyticsMessage } from '@global-torque/domain-types/analyticsTypes';
import { InvestKycTypes, type IKycProfile } from '@global-torque/domain-types/kycTypes';

function isEntityProfile(profileType: ProfileType) {
  return profileType === PROFILE_TYPES.ENTITY;
}

const message: Pick<IAnalyticsMessage, 'level' | 'message'> = {
  level: AnalyticsLogLevel.ERROR,
  message: 'Request failed',
};

const kycProfile: Pick<IKycProfile, 'kyc_status'> = {
  kyc_status: InvestKycTypes.pending,
};
```
