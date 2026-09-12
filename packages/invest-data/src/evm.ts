import type { InvestDataClient } from './client.ts';
import type { IEvmWalletAuthorizeStartRequestBody } from '@webdevelop-pro/domain-types/evmTypes';

export type RegisterTurnkeyWalletRequest = {
  profile_id: number;
  provider_name: 'turnkey';
  wallet_address: string;
  challenge_id: number;
  challenge_signature: string;
  turnkey_sub_org_id: string;
  turnkey_user_id: string;
  turnkey_wallet_id: string;
  turnkey_account_id: string;
};

export type RegisterWalletRequest = RegisterTurnkeyWalletRequest;

export type WalletRegistrationChallengeRequest = {
  provider_name: 'turnkey';
  wallet_address: string;
  chain: string;
  turnkey_otp_attempt_id: string;
};

export type WalletRegistrationChallengeResponse = {
  profile_id?: number;
  offer_id?: number;
  challenge_id: number;
  provider_name: 'turnkey';
  wallet_address: string;
  chain: string;
  nonce: string;
  expires_at: string;
  message: string;
  signature_request?: {
    type?: string;
    message?: string;
    data?: unknown;
  } & Record<string, unknown>;
};

export type WalletAuthorizeStartRequest = IEvmWalletAuthorizeStartRequestBody;

export type WalletAuthorizeConfirmRequest = {
  session_id: string;
  owner_signature: string;
  turnkey_policy_id?: string;
  turnkey_policy_name?: string;
  turnkey_policy_activity_id?: string;
};

export type GetAuthorizeSessionsParams = {
  assetAddress?: string;
  authorizationOptionId?: string;
  chain?: string;
  operationType?: string;
  status?: string;
  toAssetAddress?: string;
};

export const createEvmWalletRepository = (client: InvestDataClient) => ({
  getWalletByProfile: <T>(profileId: number) =>
    client.get<T>(`/auth/wallet/${profileId}`),

  createWalletRegistrationChallenge: <T>(
    profileId: number,
    payload: WalletRegistrationChallengeRequest,
  ) =>
    client.post<T>(`/auth/wallet/register/challenge/${profileId}`, payload),

  registerWallet: <T>(profileId: number, payload: RegisterWalletRequest) =>
    client.put<T>(`/auth/wallet/register/${profileId}`, payload),

  authorizeWithdrawStart: <T>(profileId: number, payload: WalletAuthorizeStartRequest) =>
    client.post<T>(`/auth/wallet/authorize/start/${profileId}`, payload),

  authorizeWithdrawConfirm: <T>(profileId: number, payload: WalletAuthorizeConfirmRequest) =>
    client.post<T>(`/auth/wallet/authorize/confirm/${profileId}`, payload),

  getAuthorizeSessions: <T>(profileId: number, params: GetAuthorizeSessionsParams = {}) =>
    client.get<T>(`/auth/wallet/authorize/sessions/${profileId}`, {
      query: {
        asset_address: params.assetAddress,
        authorization_option_id: params.authorizationOptionId,
        chain: params.chain,
        operation_type: params.operationType,
        status: params.status,
        to_asset_address: params.toAssetAddress,
      },
    }),
});
