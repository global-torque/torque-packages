<script setup lang="ts">
import { computed } from 'vue';
import type { WalletAuthOperationIntent } from '@global-torque/invest-core/wallet/auth';
import {
  buildWalletAuthExplorerLink,
  formatWalletAuthAddressValue,
  formatWalletAuthAssetValue,
  getWalletAuthExchangeTargetAssetAddress,
  shortenWalletAuthOperationText,
} from '@global-torque/invest-core/wallet/operationPresentation';

const props = defineProps<{
  intent: WalletAuthOperationIntent;
  scanBaseUrl?: string;
  networkLabel?: string;
}>();

const getNetworkLabel = (chain: string) => {
  const normalizedChain = chain.trim().toLowerCase();

  switch (normalizedChain) {
    case 'ethereum':
      return 'Ethereum (ERC20)';
    case 'ethereum-sepolia':
      return 'Ethereum Sepolia';
    case 'polygon':
      return 'Polygon';
    case 'base':
      return 'Base';
    default:
      return chain;
  }
};

const networkLabel = computed(() =>
  props.networkLabel || getNetworkLabel(props.intent.chain)
);

const scanBaseUrl = computed(() =>
  String(props.scanBaseUrl || '').replace(/\/$/, '')
);

const buildScanLink = (
  type: 'address' | 'token',
  value: string,
  text: string,
  ariaLabel: string,
) => buildWalletAuthExplorerLink({
  baseUrl: scanBaseUrl.value,
  type,
  value,
  text,
  ariaLabel,
});

const sourceAssetLink = computed(() =>
  buildScanLink(
    'token',
    props.intent.assetAddress,
    formatWalletAuthAssetValue(props.intent.assetSymbol, props.intent.assetAddress),
    `View ${props.intent.assetSymbol} token on network explorer`,
  )
);

const destinationWalletLink = computed(() =>
  buildScanLink(
    'address',
    props.intent.destinationAddress,
    formatWalletAuthAddressValue(props.intent.destinationAddress),
    'View recipient wallet on network explorer',
  )
);

const exchangeTargetAssetLink = computed(() => {
  if (props.intent.source !== 'exchange') {
    return null;
  }

  return buildScanLink(
    'token',
    props.intent.toAssetAddress,
    formatWalletAuthAssetValue(props.intent.toAssetSymbol, props.intent.toAssetAddress),
    `View ${props.intent.toAssetSymbol} token on network explorer`,
  );
});

const requestId = computed(() => shortenWalletAuthOperationText(props.intent.nonce));

const sourceAssetText = computed(() =>
  formatWalletAuthAssetValue(props.intent.assetSymbol, props.intent.assetAddress)
);

const destinationWalletText = computed(() =>
  formatWalletAuthAddressValue(props.intent.destinationAddress)
);

const exchangeTargetAssetText = computed(() => {
  if (props.intent.source !== 'exchange') {
    return '';
  }

  return formatWalletAuthAssetValue(props.intent.toAssetSymbol, props.intent.toAssetAddress);
});

const exchangeTargetAssetAddress = computed(() =>
  getWalletAuthExchangeTargetAssetAddress(props.intent)
);

const estimatedReceiveText = computed(() =>
  props.intent.source === 'exchange' ? props.intent.estimatedReceiveText : ''
);

const estimatedRateText = computed(() =>
  props.intent.source === 'exchange' ? props.intent.estimatedRateText : ''
);
</script>

<template>
  <section
    class="wallet-auth-operation-summary"
    data-testid="wallet-auth-operation-summary"
  >
    <p
      v-if="intent.source === 'withdrawal'"
      class="wallet-auth-operation-summary__text"
    >
      With this operation, you will withdraw
      <strong>{{ intent.amount }} {{ intent.assetSymbol }}</strong>
      on <strong>{{ networkLabel }}</strong> to wallet
      <a
        v-if="destinationWalletLink"
        :href="destinationWalletLink.href"
        :title="destinationWalletLink.title"
        :aria-label="destinationWalletLink.ariaLabel"
        target="_blank"
        rel="noopener noreferrer"
        class="wallet-auth-operation-summary__link"
      >
        {{ destinationWalletLink.text }}
      </a>
      <span
        v-else
        :title="intent.destinationAddress"
      >
        {{ destinationWalletText }}
      </span>
      using the
      <a
        v-if="sourceAssetLink"
        :href="sourceAssetLink.href"
        :title="sourceAssetLink.title"
        :aria-label="sourceAssetLink.ariaLabel"
        target="_blank"
        rel="noopener noreferrer"
        class="wallet-auth-operation-summary__link"
      >
        {{ sourceAssetLink.text }}
      </a>
      <span
        v-else
        :title="intent.assetAddress"
      >
        {{ sourceAssetText }}
      </span>
      token contract.
    </p>

    <p
      v-else
      class="wallet-auth-operation-summary__text"
    >
      With this operation, you will exchange
      <strong>{{ intent.amount }} {{ intent.assetSymbol }}</strong>
      on <strong>{{ networkLabel }}</strong> from
      <a
        v-if="sourceAssetLink"
        :href="sourceAssetLink.href"
        :title="sourceAssetLink.title"
        :aria-label="sourceAssetLink.ariaLabel"
        target="_blank"
        rel="noopener noreferrer"
        class="wallet-auth-operation-summary__link"
      >
        {{ sourceAssetLink.text }}
      </a>
      <span
        v-else
        :title="intent.assetAddress"
      >
        {{ sourceAssetText }}
      </span>
      to
      <a
        v-if="exchangeTargetAssetLink"
        :href="exchangeTargetAssetLink.href"
        :title="exchangeTargetAssetLink.title"
        :aria-label="exchangeTargetAssetLink.ariaLabel"
        target="_blank"
        rel="noopener noreferrer"
        class="wallet-auth-operation-summary__link"
      >
        {{ exchangeTargetAssetLink.text }}
      </a>
      <span
        v-else
        :title="exchangeTargetAssetAddress"
      >
        {{ exchangeTargetAssetText }}
      </span>
      and receive it in wallet
      <a
        v-if="destinationWalletLink"
        :href="destinationWalletLink.href"
        :title="destinationWalletLink.title"
        :aria-label="destinationWalletLink.ariaLabel"
        target="_blank"
        rel="noopener noreferrer"
        class="wallet-auth-operation-summary__link"
      >
        {{ destinationWalletLink.text }}
      </a>
      <span
        v-else
        :title="intent.destinationAddress"
      >
        {{ destinationWalletText }}
      </span>
      <template v-if="estimatedReceiveText">
        . Estimated receive: <strong>{{ estimatedReceiveText }}</strong>
      </template>
      <template v-if="estimatedRateText">
        . Rate: <strong>{{ estimatedRateText }}</strong>
      </template>
      .
    </p>

    <p class="wallet-auth-operation-summary__request">
      This operation cannot be reversed. Request ID:
      <span
        class="wallet-auth-operation-summary__request-id"
        :title="intent.nonce"
      >
        {{ requestId }}
      </span>
    </p>
  </section>
</template>

<style lang="scss" scoped>
.wallet-auth-operation-summary {
  padding: 16px 18px;
  border: 1px solid var(--input);
  border-radius: 8px;
  background: var(--muted);

  &__text {
    margin: 0;
    color: var(--color-text-strong);
    font-size: 14px;
    line-height: 22px;

    & + & {
      margin-top: 10px;
    }
  }

  &__link {
    color: var(--primary);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
    overflow-wrap: anywhere;
  }

  &__request {
    margin: 12px 0 0;
    color: var(--muted-foreground);
    font-size: 12px;
    line-height: 18px;
  }

  &__request-id {
    color: var(--color-text-strong);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
}
</style>
