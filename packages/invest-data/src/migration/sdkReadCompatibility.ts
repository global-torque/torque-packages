import {
  SdkHttpError,
  SdkNetworkError,
  SdkResponseParseError,
  type SdkHttpMethod,
} from "@global-torque/sdk";
import {
  validateOfferDetailResponse,
  validateOfferListResponse,
  type OfferDetailResponse,
  type OfferListResponse,
} from "@global-torque/sdk/resources/offers";
import {
  createCompatibilityHttpRequest,
  projectSdkHttpError,
} from "./compatibilityErrorProjection.ts";
import { APIError } from "../service/handlers/apiError.ts";
import { NetworkRequestError } from "../service/handlers/networkRequestError.ts";

export type CompatibilitySdkRequestInput<T> = {
  execute: () => Promise<T>;
  method: SdkHttpMethod;
  requestUrl: string;
};

export type CompatibilitySdkReadInput<T> = CompatibilitySdkRequestInput<T> & {
  method: "GET" | "OPTIONS";
};

export const resolveCompatibilityServiceRequestUrl = (
  baseUrl: string,
  requestPath: string,
): string => {
  const normalizedBase = new URL(baseUrl);
  if (!normalizedBase.pathname.endsWith("/")) {
    normalizedBase.pathname = `${normalizedBase.pathname}/`;
  }
  return new URL(requestPath.replace(/^\/+/u, ""), normalizedBase).href;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeExactDecimalString = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const match = /^(0|[1-9][0-9]{0,19})(?:\.([0-9]{1,18}))?$/u.exec(value);
  if (!match) return value;
  const fraction = (match[2] ?? "").replace(/0+$/u, "");
  return fraction ? `${match[1]}.${fraction}` : match[1];
};

const normalizeOfferCompatibilityFields = (
  offer: Record<string, unknown>,
): Record<string, unknown> => ({
  ...offer,
  price_per_share: normalizeExactDecimalString(offer.price_per_share),
  min_investment: normalizeExactDecimalString(offer.min_investment),
});

const projectOfferForCompatibilityValidation = (
  offer: unknown,
): unknown => {
  if (!isRecord(offer)) return offer;
  const contractItem = { ...offer };
  delete contractItem.close_at;
  return contractItem;
};

/**
 * The deployed offers API may serialize two exact-decimal fields with trailing
 * fractional zeroes, a legacy list-only `created_at` field, and non-RFC-3339
 * `close_at` values. Keep that compatibility in the private adapter, then
 * validate a contract-only projection with the canonical SDK validator.
 */
export const validateOfferListCompatibilityResponse = (
  value: unknown,
): OfferListResponse => {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return validateOfferListResponse(value);
  }

  const normalizedValue = {
    ...value,
    data: value.data.map((item) => {
      if (!isRecord(item)) return item;
      return normalizeOfferCompatibilityFields(item);
    }),
  };
  validateOfferListResponse({
    ...normalizedValue,
    data: normalizedValue.data.map((item) => {
      const contractItem = projectOfferForCompatibilityValidation(item);
      if (!isRecord(contractItem) || typeof contractItem.created_at !== "string") {
        return contractItem;
      }
      delete contractItem.created_at;
      return contractItem;
    }),
  });
  return normalizedValue as OfferListResponse;
};

export const validateOfferListCompatibilityEnvelope = (
  value: unknown,
): Record<string, unknown> & { data: unknown[]; count?: number } => {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    validateOfferListResponse(value);
    throw new TypeError("Offer list compatibility validation did not return an envelope.");
  }

  validateOfferListResponse({
    data: [],
    ...(Object.hasOwn(value, "count") ? { count: value.count } : {}),
  });
  return value as Record<string, unknown> & { data: unknown[]; count?: number };
};

/** Apply the same narrow deployed-offer compatibility to offer details. */
export const validateOfferDetailCompatibilityResponse = (
  value: unknown,
): OfferDetailResponse => {
  const normalizedValue = isRecord(value)
    ? normalizeOfferCompatibilityFields(value)
    : value;
  validateOfferDetailResponse(
    projectOfferForCompatibilityValidation(normalizedValue),
  );
  return normalizedValue as OfferDetailResponse;
};

/**
 * Keep legacy repository error identities while a read moves to a typed SDK
 * resource. Contract-validation and explicit SDK configuration errors remain
 * SDK-native because the legacy client had no equivalent boundary.
 */
export const executeSdkRequestWithCompatibilityErrors = async <T>({
  execute,
  method,
  requestUrl,
}: CompatibilitySdkRequestInput<T>): Promise<T> => {
  try {
    return await execute();
  } catch (error) {
    const httpRequest = createCompatibilityHttpRequest(method, requestUrl);
    if (error instanceof SdkHttpError) {
      const { response } = projectSdkHttpError(error);
      const compatibilityError = new APIError(
        "Failed to fetch data",
        response,
        httpRequest,
      );
      compatibilityError.isFatal = false;
      compatibilityError.showGlobalAlertOnServerError = true;
      await compatibilityError.initializeResponseJson();
      throw compatibilityError;
    }
    if (error instanceof SdkNetworkError) {
      throw new NetworkRequestError(
        error,
        httpRequest,
        {},
        {
          retryable: true,
          attempts: error.attempts ?? 1,
        },
      );
    }
    if (error instanceof SdkResponseParseError) {
      throw new SyntaxError("Unexpected token in JSON response");
    }
    throw error;
  }
};

export const executeSdkReadWithCompatibilityErrors = <T>(
  input: CompatibilitySdkReadInput<T>,
): Promise<T> => executeSdkRequestWithCompatibilityErrors(input);
