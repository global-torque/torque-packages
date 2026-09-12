# KYC Feature

The final KYC ownership is split by responsibility:

- `@webdevelop-pro/domain-types/kycTypes` owns DTOs and Plaid result contracts.
- `@webdevelop-pro/invest-core/kyc/*` owns deterministic alert and third-party screen mapping.
- `useKycModel.ts` owns the route-independent reactive Plaid/token model.
- `useKycAlertViewModel.ts` owns route-independent KYC alert and CTA behavior exposed through `invest-widgets` providers.
- `useKycThirdParty.ts` owns the public third-party Plaid state machine.
- Dashboard owns its KYC route, composed form workflow, validation, submission, redirects, and route constants under `apps/dashboard/src/features/kyc`.

## Behavior

The shared alert model hides approved profiles, maps declined status to an error alert and in-progress status to an informational alert, resolves the acting individual for SDIRA and Solo 401(k) profiles, and either opens Dashboard's KYC form or starts Plaid. Contact links delegate to the runtime dialog port.

The Dashboard form validates personal, financial, Plaid-consent, and optional custom-field sections before saving. It saves the profile, performs non-blocking user synchronization, launches Plaid, creates escrow when needed, refreshes the profile, and returns to a validated redirect or Dashboard account route.

The third-party flow reads its token in the browser, reports missing tokens as invalid, distinguishes successful completion from an incomplete exit, and reports bootstrap failures through the runtime error reporter. All browser access remains SSR guarded.

## Tests

- `logic/__tests__/useKycAlertViewModel.test.ts` covers shared alert actions and contact behavior.
- `logic/__tests__/useKycThirdParty.test.ts` covers the third-party state machine.
- `model/__tests__/useKycModel.test.ts` covers token creation, Plaid session matching, completion, exit, and reset.
- Dashboard's `features/kyc/logic/__tests__/useFormFinancialInformationAndKyc.test.ts` covers validation, payloads, loading, errors, redirects, and background work.

Do not restore KYC implementations, routes, or presentation under `invest-common`. New app-specific KYC form behavior belongs to the app; reusable route-independent behavior must stay behind the existing feature/widget/runtime contracts.
