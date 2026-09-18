import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../service/apiClient.ts';
import { createApiClientHooks } from '../service/apiClientHooks.ts';
import { createVaultClient } from '../vault.ts';
import type { VaultResource } from '@global-torque/sdk/resources/vault';

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { 'content-type': 'application/json' },
});

describe('Vault client', () => {
  it('loads exact nested Vault positions from the investment API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      position: {
        offer_id: 42,
        profile_id: 9,
        vault: {
          deployment: {
            contract_id: 7,
            status: 'verified',
            chain: 'ethereum-sepolia',
            address: '0x1111111111111111111111111111111111111111',
            asset: {
              symbol: 'USDC',
              address: '0x2222222222222222222222222222222222222222',
              decimals: 6,
            },
            share: {
              symbol: 'RWA',
              address: '0x1111111111111111111111111111111111111111',
              decimals: 18,
            },
          },
          deposit: null,
          position: {
            share_balance_raw: '250000000000000000',
            historical_claimed_shares_raw: '0',
            available_to_redeem_shares_raw: '250000000000000000',
          },
          redemptions: [],
        },
      },
    }));
    const hooks = createApiClientHooks({
      createRequestId: () => 'vault-position-request',
      isOnline: () => true,
    });
    const client = createVaultClient({
      investment: new ApiClient('https://investment.example.test', { fetch: fetchMock, hooks }),
      evm: new ApiClient('https://evm.example.test', { fetch: fetchMock, hooks }),
    });

    const position = await client.getPosition(42);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://investment.example.test/auth/positions?offer_id=42',
      expect.objectContaining({ method: 'GET' }),
    );
    const headers = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get('x-request-id')).toBe('vault-position-request');
    expect(position.profile_id).toBe(9);
    expect(position.vault.position.available_to_redeem_shares_raw)
      .toBe('250000000000000000');
  });

  it('delegates all five compatibility methods with exact SDK inputs', async () => {
    const redemption = {
      id: 73,
      offer_id: 42,
      profile_id: 9,
      vault_request_origin: 'application',
      status: 'pending',
      protocol_state: 'unconfirmed',
      share_amount_raw: '250000000000000000',
      pending_shares_raw: '0',
      claimable_assets_raw: '0',
      claimable_shares_raw: '0',
      claimed_assets_raw: '0',
      claimed_shares_raw: '0',
    };
    const result = (data: unknown) => ({ data, status: 200, headers: new Headers() });
    const vault = {
      getPosition: vi.fn(async () => result({ position: {
        offer_id: 42,
        profile_id: 9,
        vault: { position: { available_to_redeem_shares_raw: '250000000000000000' } },
      } })),
      createRedemption: vi.fn(async () => result({ redemption, replayed: false })),
      listRedemptions: vi.fn(async () => result({ count: 1, data: [redemption] })),
      getRedemption: vi.fn(async () => result({ redemption })),
      cancelRedemption: vi.fn(async () => result({
        redemption: { ...redemption, status: 'cancelled' },
      })),
    } as unknown as VaultResource;
    const hooks = createApiClientHooks({ isOnline: () => true });
    const unusedFetch = vi.fn();
    const client = createVaultClient({
      investment: new ApiClient('https://investment.example.test', { fetch: unusedFetch, hooks }),
      evm: new ApiClient('https://evm.example.test', { fetch: unusedFetch, hooks }),
      vault,
    });

    await client.getPosition(42);
    await client.createRedemption({
      offer_id: 42,
      shares_raw: '250000000000000000',
    }, 'redemption-idempotency-73');
    await client.listRedemptions({ profileId: 9, includeCompleted: false });
    await client.getRedemption(73);
    const cancelled = await client.cancelRedemption(73);

    expect(vault.getPosition).toHaveBeenCalledWith({ offerId: 42 });
    expect(vault.createRedemption).toHaveBeenCalledWith({
      offerId: 42,
      sharesRaw: '250000000000000000',
      idempotencyKey: 'redemption-idempotency-73',
    });
    expect(vault.listRedemptions).toHaveBeenCalledWith({
      profileId: 9,
      includeCompleted: false,
    });
    expect(vault.getRedemption).toHaveBeenCalledWith({ redemptionId: 73 });
    expect(vault.cancelRedemption).toHaveBeenCalledWith({ redemptionId: 73 });
    expect(cancelled.status).toBe('cancelled');
    expect(unusedFetch).not.toHaveBeenCalled();
  });

  it('preserves legacy offline, HTTP, network, and parse errors through the SDK facade', async () => {
    const offlineFetch = vi.fn();
    const offlineHooks = createApiClientHooks({ isOnline: () => false });
    const offlineClient = createVaultClient({
      investment: new ApiClient('https://investment.example.test', {
        fetch: offlineFetch,
        hooks: offlineHooks,
      }),
      evm: new ApiClient('https://evm.example.test', { fetch: offlineFetch, hooks: offlineHooks }),
    });
    await expect(offlineClient.createRedemption({
      offer_id: 42,
      shares_raw: '250000000000000000',
    }, 'redemption-idempotency-73')).rejects.toMatchObject({ name: 'OfflineRequestError' });
    expect(offlineFetch).not.toHaveBeenCalled();

    const onlineHooks = createApiClientHooks({ isOnline: () => true });
    const httpFetch = vi.fn().mockResolvedValue(jsonResponse({ __error__: 'No access' }));
    httpFetch.mockResolvedValueOnce(new Response(JSON.stringify({ __error__: 'No access' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }));
    const httpClient = createVaultClient({
      investment: new ApiClient('https://investment.example.test', { fetch: httpFetch, hooks: onlineHooks }),
      evm: new ApiClient('https://evm.example.test', { fetch: httpFetch, hooks: onlineHooks }),
    });
    await expect(httpClient.getPosition(42)).rejects.toMatchObject({
      name: 'APIError',
      data: { statusCode: 403, responseJson: { __error__: 'No access' } },
    });

    const networkFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const networkClient = createVaultClient({
      investment: new ApiClient('https://investment.example.test', {
        fetch: networkFetch,
        hooks: onlineHooks,
      }),
      evm: new ApiClient('https://evm.example.test', { fetch: networkFetch, hooks: onlineHooks }),
    });
    await expect(networkClient.getPosition(42)).rejects.toMatchObject({
      name: 'NetworkRequestError',
      data: { attempts: 2, retryable: true },
    });

    const parseFetch = vi.fn().mockResolvedValue(new Response('{', {
      headers: { 'content-type': 'application/json' },
    }));
    const parseClient = createVaultClient({
      investment: new ApiClient('https://investment.example.test', { fetch: parseFetch, hooks: onlineHooks }),
      evm: new ApiClient('https://evm.example.test', { fetch: parseFetch, hooks: onlineHooks }),
    });
    await expect(parseClient.getPosition(42)).rejects.toBeInstanceOf(SyntaxError);
  });

  it('lists validated redemptions through the SDK resource compatibility facade', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      count: 1,
      data: [{
        id: 73,
        offer_id: 42,
        profile_id: 9,
        vault_contract_id: 7,
        request_controller_chain_account_id: 11,
        request_controller_address: '0x1111111111111111111111111111111111111111',
        vault_request_origin: 'application',
        status: 'pending',
        protocol_state: 'unconfirmed',
        share_amount_raw: '250000000000000000',
        pending_shares_raw: '0',
        claimable_assets_raw: '0',
        claimable_shares_raw: '0',
        claimed_assets_raw: '0',
        claimed_shares_raw: '0',
        liquidity_shortfall_raw: '0',
        transition_version: 1,
      }],
    }));
    const hooks = createApiClientHooks({ isOnline: () => true });
    const client = createVaultClient({
      investment: new ApiClient('https://investment.example.test', { fetch: fetchMock, hooks }),
      evm: new ApiClient('https://evm.example.test', { fetch: fetchMock, hooks }),
    });

    const result = await client.listRedemptions({
      profileId: 9,
      includeCompleted: false,
    });

    expect(result).toEqual({
      count: 1,
      data: [expect.objectContaining({
        id: 73,
        offer_id: 42,
        profile_id: 9,
        request_origin: 'application',
      })],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://investment.example.test/auth/redemptions?profile_id=9&include_completed=false',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('uses canonical investment intent and EVM lifecycle routes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        redemption: {
          id: 73,
          offer_id: 42,
          profile_id: 9,
          investment_id: null,
          vault_contract_id: 7,
          request_controller_chain_account_id: 11,
          request_controller_address: '0x1111111111111111111111111111111111111111',
          vault_request_origin: 'application',
          vault_request_effect_id: null,
          request_effect_state: 'unassigned',
          status: 'pending',
          protocol_state: 'unconfirmed',
          estimated_nav_record_id: 77,
          estimated_nav_version: 4,
          estimated_nav_usdc_raw: '25000000',
          estimated_nav_valuation_block_number: 9100000,
          estimated_nav_valuation_as_of: '2026-07-28T12:00:00Z',
          estimated_asset_amount_raw: '6250000',
          dealing_cutoff_block_number: null,
          dealing_cutoff_at: null,
          nav_record_id: null,
          nav_version: null,
          nav_usdc_raw: null,
          nav_valuation_block_number: null,
          nav_valuation_as_of: null,
          asset_amount_raw: null,
          estimate_delta_raw: null,
          share_amount_raw: '250000000000000000',
          pending_shares_raw: '0',
          claimable_assets_raw: '0',
          claimable_shares_raw: '0',
          claimed_assets_raw: '0',
          claimed_shares_raw: '0',
          liquidity_shortfall_raw: '0',
          transition_version: 1,
          request_locked_at: null,
        },
        replayed: false,
      }))
      .mockResolvedValueOnce(jsonResponse({
        operation_id: 91,
        stage: 'awaiting_signature',
      }))
      .mockResolvedValueOnce(jsonResponse({
        action: 'request_redeem',
        operation: { id: 91, status: 'created' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({
        redemption: {
          id: 73,
          offer_id: 42,
          profile_id: 9,
          investment_id: null,
          vault_contract_id: 7,
          request_controller_chain_account_id: 11,
          request_controller_address: '0x1111111111111111111111111111111111111111',
          vault_request_origin: 'application',
          vault_request_effect_id: null,
          request_effect_state: 'unassigned',
          status: 'cancelled',
          protocol_state: 'unconfirmed',
          estimated_nav_record_id: 77,
          estimated_nav_version: 4,
          estimated_nav_usdc_raw: '25000000',
          estimated_nav_valuation_block_number: 9100000,
          estimated_nav_valuation_as_of: '2026-07-28T12:00:00Z',
          estimated_asset_amount_raw: '6250000',
          dealing_cutoff_block_number: null,
          dealing_cutoff_at: null,
          nav_record_id: null,
          nav_version: null,
          nav_usdc_raw: null,
          nav_valuation_block_number: null,
          nav_valuation_as_of: null,
          asset_amount_raw: null,
          estimate_delta_raw: null,
          share_amount_raw: '250000000000000000',
          pending_shares_raw: '0',
          claimable_assets_raw: '0',
          claimable_shares_raw: '0',
          claimed_assets_raw: '0',
          claimed_shares_raw: '0',
          liquidity_shortfall_raw: '0',
          transition_version: 1,
          request_locked_at: null,
        },
      }));
    const hooks = createApiClientHooks({ isOnline: () => true });
    const client = createVaultClient({
      investment: new ApiClient('https://investment.example.test', { fetch: fetchMock, hooks }),
      evm: new ApiClient('https://evm.example.test', { fetch: fetchMock, hooks }),
    });

    const redemption = await client.createRedemption({
      offer_id: 42,
      shares_raw: '250000000000000000',
    }, 'redeem-42-250000000000000000');
    await client.prepareRedemptionRequest(73);
    await client.getRedemptionRequestStatus(73);
    await client.abandonRedemptionRequest(73);
    await client.cancelRedemption(73);

    expect(redemption).toMatchObject({
      id: 73,
      request_origin: 'application',
      estimate: {
        nav_record_id: 77,
        asset_amount_raw: '6250000',
        valuation_block_number: '9100000',
      },
      dealing_cutoff: null,
      final: null,
      operations: { request: null, fulfillment: null, claim: null },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://investment.example.test/auth/redemptions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          offer_id: 42,
          shares_raw: '250000000000000000',
        }),
      }),
    );
    const firstRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(firstRequest.headers).get('Idempotency-Key'))
      .toBe('redeem-42-250000000000000000');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://evm.example.test/auth/redemptions/73/request',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://evm.example.test/auth/redemptions/73/request',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://evm.example.test/auth/redemptions/73/request',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://investment.example.test/auth/redemptions/73',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('uses the canonical custody and deposit-claim lifecycle routes', async () => {
    const investmentFetch = vi.fn();
    const evmFetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        operation_id: 101,
        stage: 'awaiting_signature',
        reused: false,
      }))
      .mockResolvedValueOnce(jsonResponse({
        operation_id: 101,
        stage: 'submitted',
        reused: true,
      }))
      .mockResolvedValueOnce(jsonResponse({
        action: 'investment_custody_status',
        business_id: 12,
        protocol_state: 'pending',
        operation: { id: 101, status: 'confirmed' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        reused: false,
        operation_id: 102,
        stage: 'awaiting_signature',
      }))
      .mockResolvedValueOnce(jsonResponse({
        reused: true,
        operation_id: 102,
        stage: 'submitted',
      }))
      .mockResolvedValueOnce(jsonResponse({
        action: 'claim_deposit',
        business_id: 12,
        protocol_state: 'claimable',
        operation: { id: 102, status: 'submitted' },
      }));
    const hooks = createApiClientHooks({ isOnline: () => true });
    const client = createVaultClient({
      investment: new ApiClient('https://investment.example.test', { fetch: investmentFetch, hooks }),
      evm: new ApiClient('https://evm.example.test', { fetch: evmFetch, hooks }),
    });

    const funding = await client.fundInvestmentCustody(12, {
      idempotency_key: 'fund-investment-12',
    });
    await client.armInvestmentCustodyFunding(12, {
      operation_id: funding.operation_id,
    });
    await client.getInvestmentCustodyStatus(12);
    const prepared = await client.prepareDepositClaim(12);
    await client.armDepositClaim(12, { operation_id: prepared.operation_id });
    await client.getDepositClaimStatus(12);

    expect(funding).toEqual({
      operation_id: 101,
      stage: 'awaiting_signature',
      reused: false,
    });

    expect(evmFetch).toHaveBeenNthCalledWith(
      1,
      'https://evm.example.test/auth/investments/12/custody/fund',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: 'fund-investment-12',
        }),
      }),
    );
    expect(evmFetch).toHaveBeenNthCalledWith(
      2,
      'https://evm.example.test/auth/investments/12/custody/fund',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ operation_id: 101 }),
      }),
    );
    expect(investmentFetch).not.toHaveBeenCalled();
    expect(evmFetch).toHaveBeenNthCalledWith(
      4,
      'https://evm.example.test/auth/investments/12/vault/claim',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(evmFetch).toHaveBeenNthCalledWith(
      5,
      'https://evm.example.test/auth/investments/12/vault/claim',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ operation_id: 102 }),
      }),
    );
  });

  it('uses controller-level routes for reconciled unassigned claims', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        action: 'claim_deposit',
        direction: 'deposit',
        operation: null,
        reconciliation: { unassigned_claimable_raw: '6250000' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        operation_id: 120,
        stage: 'awaiting_signature',
      }))
      .mockResolvedValueOnce(jsonResponse({
        operation_id: 120,
        stage: 'signing_or_submitting',
      }));
    const hooks = createApiClientHooks({ isOnline: () => true });
    const client = createVaultClient({
      investment: new ApiClient('https://investment.example.test', { fetch: fetchMock, hooks }),
      evm: new ApiClient('https://evm.example.test', { fetch: fetchMock, hooks }),
    });

    await client.getControllerClaimStatus(7, 'deposit');
    const prepared = await client.prepareControllerClaim(7, 'deposit');
    await client.armControllerClaim(7, 'deposit', { operation_id: prepared.operation_id });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://evm.example.test/auth/vaults/7/claims/deposit',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://evm.example.test/auth/vaults/7/claims/deposit',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://evm.example.test/auth/vaults/7/claims/deposit',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ operation_id: 120 }),
      }),
    );
  });
});
