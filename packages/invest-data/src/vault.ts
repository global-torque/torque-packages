import type {
  ArmVaultOperationRequest,
  CreateVaultRedemptionRequest,
  VaultClaimDirection,
  VaultCustodyFundingRequest,
  VaultLifecycleStatus,
  VaultPosition,
  VaultRedemption,
  VaultSigningPayload,
} from "@global-torque/domain-types/vaultTypes";
import type {
  SdkConvenienceRequestOptions,
  SdkHttpMethod,
  SdkQueryValue,
  SdkResponseValidator,
  SdkResult,
  SdkServiceClient,
} from "@global-torque/sdk";
import {
  createVaultResource,
  type VaultResource,
} from "@global-torque/sdk/resources/vault";
import type { ApiClient } from "./service/apiClient.ts";
import { createInvestDataApiClient } from "./service/dataClientConfig.ts";

export interface VaultApiClients {
  investment: ApiClient;
  evm: ApiClient;
  vault: VaultResource;
}

type VaultSdkRequestOptions = Omit<
  SdkConvenienceRequestOptions,
  "responseValidator"
> & {
  responseValidator?: SdkResponseValidator<unknown>;
};

type VaultSdkRequest = VaultSdkRequestOptions & {
  method: SdkHttpMethod;
  path: string;
  body?: unknown;
};

const compatibilityParams = (
  query: Record<string, SdkQueryValue | readonly SdkQueryValue[]> | undefined,
): Record<string, string | number | boolean | null | undefined> | undefined => {
  if (!query) return undefined;
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => {
      if (Array.isArray(value)) {
        throw new TypeError(
          `Vault compatibility query "${key}" must be a scalar value.`,
        );
      }
      return [key, value];
    }),
  ) as Record<string, string | number | boolean | null | undefined>;
};

/**
 * Preserve the ApiClient transport/hooks while making the SDK Vault resource
 * the single owner of endpoint mapping and synchronous response validation.
 */
const createVaultSdkCompatibilityClient = (
  client: ApiClient,
): SdkServiceClient => {
  const execute = async (
    input: VaultSdkRequest,
  ): Promise<SdkResult<unknown>> => {
    const requestHeaders = new Headers(input.headers);
    if (input.requestId) requestHeaders.set("x-request-id", input.requestId);
    const requestConfig = {
      headers: requestHeaders,
      idempotencyKey: input.idempotencyKey,
      params: compatibilityParams(input.query),
      retry: input.retry?.maxRetries,
      retryDelayMs: input.retry?.delayMs,
      signal: input.signal,
      timeoutMs: input.timeoutMs,
      type: input.responseMode === "auto" ? undefined : input.responseMode,
    } as const;
    const response =
      input.method === "GET"
        ? await client.get(input.path, requestConfig)
        : input.method === "OPTIONS"
          ? await client.options(input.path, requestConfig)
          : input.method === "POST"
            ? await client.post(input.path, input.body, requestConfig)
            : input.method === "PUT"
              ? await client.put(input.path, input.body, requestConfig)
              : input.method === "PATCH"
                ? await client.patch(input.path, input.body, requestConfig)
                : await client.delete(input.path, input.body, requestConfig);
    const data = input.responseValidator
      ? input.responseValidator(response.data)
      : response.data;
    const requestId = response.headers.get("x-request-id")?.trim();
    const correlationId = input.requestId ?? response.clientRequestId;
    return {
      data,
      status: response.status,
      headers: response.headers,
      ...(requestId ? { requestId } : {}),
      metadata: Object.freeze({
        requestId: correlationId,
        attempts: response.attempts,
        source: "unknown",
      }),
    };
  };

  const clientAdapter = {
    request: (input: VaultSdkRequest) => execute(input),
    get: (path: string, options: VaultSdkRequestOptions = {}) =>
      execute({
        ...options,
        method: "GET",
        path,
      }),
    options: (path: string, options: VaultSdkRequestOptions = {}) =>
      execute({
        ...options,
        method: "OPTIONS",
        path,
      }),
    post: (path: string, body: unknown, options: VaultSdkRequestOptions = {}) =>
      execute({
        ...options,
        method: "POST",
        path,
        body,
      }),
    put: (path: string, body: unknown, options: VaultSdkRequestOptions = {}) =>
      execute({
        ...options,
        method: "PUT",
        path,
        body,
      }),
    patch: (
      path: string,
      body: unknown,
      options: VaultSdkRequestOptions = {},
    ) =>
      execute({
        ...options,
        method: "PATCH",
        path,
        body,
      }),
    delete: (
      path: string,
      body: unknown,
      options: VaultSdkRequestOptions = {},
    ) =>
      execute({
        ...options,
        method: "DELETE",
        path,
        body,
      }),
  };

  return clientAdapter as unknown as SdkServiceClient;
};

const responseBody = async (
  request: Promise<{ data: unknown | undefined }>,
): Promise<unknown> => {
  const response = await request;
  if (response.data === undefined) {
    throw new Error("Vault API response did not include a response body.");
  }
  return response.data;
};

const responseData = async <T>(
  request: Promise<{ data: unknown | undefined }>,
): Promise<T> => {
  return responseBody(request) as Promise<T>;
};

const responseDone = async (request: Promise<unknown>): Promise<void> => {
  await request;
};

const normalizeRedemption = (
  value: Record<string, unknown>,
): VaultRedemption => {
  const estimate =
    value.estimated_nav_record_id == null
      ? null
      : {
          nav_record_id: Number(value.estimated_nav_record_id),
          nav_version: Number(value.estimated_nav_version),
          nav_usdc_raw: String(value.estimated_nav_usdc_raw),
          valuation_block_number: String(
            value.estimated_nav_valuation_block_number,
          ),
          valuation_as_of: String(value.estimated_nav_valuation_as_of),
          asset_amount_raw: String(value.estimated_asset_amount_raw),
        };
  const dealingCutoff =
    value.dealing_cutoff_block_number == null
      ? null
      : {
          block_number: String(value.dealing_cutoff_block_number),
          at: String(value.dealing_cutoff_at),
        };
  const final =
    value.nav_record_id == null
      ? null
      : {
          nav_record_id: Number(value.nav_record_id),
          nav_version: Number(value.nav_version),
          nav_usdc_raw: String(value.nav_usdc_raw),
          valuation_block_number: String(value.nav_valuation_block_number),
          valuation_as_of: String(value.nav_valuation_as_of),
          asset_amount_raw: String(value.asset_amount_raw),
          delta_from_estimate_raw:
            value.estimate_delta_raw == null
              ? null
              : String(value.estimate_delta_raw),
        };

  return {
    id: Number(value.id),
    offer_id: Number(value.offer_id),
    profile_id: Number(value.profile_id),
    investment_id:
      value.investment_id == null ? null : Number(value.investment_id),
    vault_contract_id:
      value.vault_contract_id == null
        ? undefined
        : Number(value.vault_contract_id),
    request_origin:
      value.vault_request_origin as VaultRedemption["request_origin"],
    request_effect_id:
      value.vault_request_effect_id == null
        ? null
        : Number(value.vault_request_effect_id),
    request_effect_state:
      value.request_effect_state as VaultRedemption["request_effect_state"],
    status: value.status as VaultRedemption["status"],
    protocol_state: value.protocol_state as VaultRedemption["protocol_state"],
    share_amount_raw: String(value.share_amount_raw),
    pending_shares_raw: String(value.pending_shares_raw),
    claimable_shares_raw: String(value.claimable_shares_raw),
    claimable_assets_raw: String(value.claimable_assets_raw),
    claimed_shares_raw: String(value.claimed_shares_raw),
    claimed_assets_raw: String(value.claimed_assets_raw),
    liquidity_shortfall_raw:
      value.liquidity_shortfall_raw == null
        ? undefined
        : String(value.liquidity_shortfall_raw),
    request_locked_at:
      value.request_locked_at == null ? null : String(value.request_locked_at),
    estimate,
    dealing_cutoff: dealingCutoff,
    final,
    operations: { request: null, fulfillment: null, claim: null },
  };
};

export const createVaultClient = (clients: Partial<VaultApiClients> = {}) => {
  const investment =
    clients.investment ?? createInvestDataApiClient("investment");
  const evm = clients.evm ?? createInvestDataApiClient("evm");
  const vault =
    clients.vault ??
    createVaultResource(createVaultSdkCompatibilityClient(investment));

  const normalizedRedemption = async (
    request:
      | ReturnType<VaultResource["getRedemption"]>
      | ReturnType<VaultResource["cancelRedemption"]>,
  ): Promise<VaultRedemption> => {
    const result = await request;
    return normalizeRedemption(
      result.data.redemption as unknown as Record<string, unknown>,
    );
  };

  return {
    createRedemption: (
      request: CreateVaultRedemptionRequest,
      idempotencyKey: string,
    ) =>
      vault
        .createRedemption({
          offerId: request.offer_id,
          sharesRaw: request.shares_raw,
          idempotencyKey,
        })
        .then((result) =>
          normalizeRedemption(
            result.data.redemption as unknown as Record<string, unknown>,
          ),
        ),

    listRedemptions: (
      params: { profileId?: number; includeCompleted?: boolean } = {},
    ) =>
      vault.listRedemptions(params).then((result) => ({
        count: result.data.count,
        data: result.data.data.map((redemption) =>
          normalizeRedemption(redemption as unknown as Record<string, unknown>),
        ),
      })),

    getRedemption: (redemptionId: number) =>
      normalizedRedemption(vault.getRedemption({ redemptionId })),

    cancelRedemption: (redemptionId: number) =>
      normalizedRedemption(vault.cancelRedemption({ redemptionId })),

    getPosition: (offerId: number): Promise<VaultPosition> =>
      vault
        .getPosition({ offerId })
        .then((result) => result.data.position as unknown as VaultPosition),

    fundInvestmentCustody: (
      investmentId: number,
      request: VaultCustodyFundingRequest,
    ) =>
      responseData<VaultSigningPayload>(
        evm.post(`/auth/investments/${investmentId}/custody/fund`, request),
      ),

    armInvestmentCustodyFunding: (
      investmentId: number,
      request: ArmVaultOperationRequest,
    ) =>
      responseData<VaultSigningPayload>(
        evm.put(`/auth/investments/${investmentId}/custody/fund`, request),
      ),

    getInvestmentCustodyStatus: (investmentId: number) =>
      responseData<VaultLifecycleStatus>(
        evm.get(`/auth/investments/${investmentId}/custody`),
      ),

    prepareDepositClaim: (investmentId: number) =>
      responseData<VaultSigningPayload>(
        evm.post(`/auth/investments/${investmentId}/vault/claim`, {}),
      ),

    armDepositClaim: (
      investmentId: number,
      request: ArmVaultOperationRequest,
    ) =>
      responseData<VaultSigningPayload>(
        evm.put(`/auth/investments/${investmentId}/vault/claim`, request),
      ),

    getDepositClaimStatus: (investmentId: number) =>
      responseData<VaultLifecycleStatus>(
        evm.get(`/auth/investments/${investmentId}/vault/claim`),
      ),

    prepareRedemptionRequest: (redemptionId: number) =>
      responseData<VaultSigningPayload>(
        evm.post(`/auth/redemptions/${redemptionId}/request`, {}),
      ),

    getRedemptionRequestStatus: (redemptionId: number) =>
      responseData<VaultLifecycleStatus>(
        evm.get(`/auth/redemptions/${redemptionId}/request`),
      ),

    armRedemptionRequest: (
      redemptionId: number,
      request: ArmVaultOperationRequest,
    ) =>
      responseData<VaultSigningPayload>(
        evm.put(`/auth/redemptions/${redemptionId}/request`, request),
      ),

    abandonRedemptionRequest: (redemptionId: number) =>
      responseDone(evm.delete(`/auth/redemptions/${redemptionId}/request`)),

    prepareRedemptionClaim: (redemptionId: number) =>
      responseData<VaultSigningPayload>(
        evm.post(`/auth/redemptions/${redemptionId}/claim`, {}),
      ),

    armRedemptionClaim: (
      redemptionId: number,
      request: ArmVaultOperationRequest,
    ) =>
      responseData<VaultSigningPayload>(
        evm.put(`/auth/redemptions/${redemptionId}/claim`, request),
      ),

    getRedemptionClaimStatus: (redemptionId: number) =>
      responseData<VaultLifecycleStatus>(
        evm.get(`/auth/redemptions/${redemptionId}/claim`),
      ),

    prepareControllerClaim: (
      contractId: number,
      direction: VaultClaimDirection,
    ) =>
      responseData<VaultSigningPayload>(
        evm.post(`/auth/vaults/${contractId}/claims/${direction}`, {}),
      ),

    armControllerClaim: (
      contractId: number,
      direction: VaultClaimDirection,
      request: ArmVaultOperationRequest,
    ) =>
      responseData<VaultSigningPayload>(
        evm.put(`/auth/vaults/${contractId}/claims/${direction}`, request),
      ),

    getControllerClaimStatus: (
      contractId: number,
      direction: VaultClaimDirection,
    ) =>
      responseData<VaultLifecycleStatus>(
        evm.get(`/auth/vaults/${contractId}/claims/${direction}`),
      ),
  };
};
