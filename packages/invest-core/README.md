# @global-torque/invest-core

Pure investment-domain logic shared by apps and packages.

## Ownership

This package owns deterministic helpers, mappers, formatters, calculations, and normalization utilities that do not need Vue, Pinia, router, browser app state, repositories, network clients, or runtime config singletons.

## Allowed Dependencies

- `@global-torque/domain-types`.
- AJV, `ajv-errors`, `ajv-formats`, `lodash-es`, and markdown-it for the published
  investment validation and formatting helpers.
- TypeScript and platform-standard value types.

## Forbidden Dependencies

- Vue, Pinia, Vue Router, or app packages.
- The retired common compatibility layer, `@global-torque/ui-kit`, or `@global-torque/ui-primitives`.
- Network clients, repositories, stores, route views, `import.meta.env`, or runtime singleton config.

## Public Exports

`app/config`, `markdown/tableWrap`, and `helpers/text` retain their source
TypeScript browser and type targets and additionally provide exact generated
`dist/node` JavaScript for plain Node/VitePress configuration consumers. The
candidate packer emits only these three Node files; all other exports remain
source based.

- `analytics/analyticsBody`: analytics request body normalization with exact
  credential-field redaction. User, business, numeric, URL, and diagnostic
  values are retained unless assigned to a known credential field.
- `decimal/canonicalDecimal`: numeric(38,18) canonical-string validation, exact scaled-integer arithmetic, comparison, and display formatting.
- `evm/walletInfo`: EVM wallet status-only response normalization and deposit-address extraction.
- `filer/publicImage`: pure public filer image URL and `srcset` builders with injected `filerUrl`.
- `formatting/dateTime`: shared en-US date and local time formatting helpers.
- `formatting/display`: USD currency formatting and first-letter capitalization.
- `investment/status`: investment status and funding clickability helpers.
- `investment/rawAmount`: exact raw-token decimal conversion, comparison, and
  presentation helpers that never use floating-point arithmetic.
- `kyc/status`, `kyc/kycAlert`, `kyc/thirdPartyScreen`: KYC status compatibility re-export from `domain-types` plus normalized view models.
- `offer/metrics`: offer funding percent, minimum investment, Reg D 506(c), recency, and funding-completion calculations.
- `profiles/formatting`: profile date and phone display formatters.
- `repository/formatterCache`: generic formatter memoization helper.
- `wallet/auth`, `wallet/setupError`: wallet-auth normalization and setup-required error classification.
- `wallet/operationPresentation`: wallet operation text shortening, asset/address labels, and injected explorer-link builders.
- `form-validation`: investment-only AJV policy, validation rule descriptors,
  immutable schema composition, empty-string normalization, and pure schema
  projection helpers. `createInvestmentAjv()` creates one validator per form;
  legacy `file` and `maxFileSize` annotations are accepted as presentation
  compatibility and do not change backend validation semantics.
- root export: compatibility barrel for the pure helpers above.

## Example

```ts
import { buildPublicFilerImageUrl } from '@global-torque/invest-core/filer/publicImage';

const imageUrl = buildPublicFilerImageUrl(42, 'medium', {
  filerUrl: 'https://filer.example.com',
});
```

Investment forms explicitly opt into policy at the UI boundary:

```ts
import {
  composeInvestmentFormSchema,
  createInvestmentAjv,
  prepareInvestmentFormData,
} from '@global-torque/invest-core/form-validation';

const validationOptions = {
  createAjv: createInvestmentAjv,
  composeSchema: composeInvestmentFormSchema,
  prepareData: prepareInvestmentFormData,
};
```
