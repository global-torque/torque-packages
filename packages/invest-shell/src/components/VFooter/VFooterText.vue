<script setup lang="ts">
defineProps<{ brandName: string }>();
</script>

<template>
  <div class="VFooterText v-footer-text">
    <div class="is--container">
      <p class="is--small">
        <strong>Demo website notice:</strong> This portal is a demonstration environment
        for evaluating the {{ brandName }} investment experience. It is not a live
        brokerage, funding portal, investment adviser, or securities offering platform.
        References to {{ brandName }}, FINRA/SIPC membership, state availability,
        BrokerCheck, Customer Relationship Summary materials, contact details, issuers,
        listings, and offering documents are included only to show how a production
        disclosure area could look.
      </p>
      <p class="is--small"><br />
        <b>Demo listings on this portal:</b>
      </p>
      <ul class="is--small v-footer-text__list">
        <li>
          are sample content for demonstration and testing only
        </li>
        <li>
          do not constitute an offer of securities or a solicitation of an offer to buy securities
        </li>
        <li>
          are not live investment opportunities and cannot be purchased, subscribed to, or funded
          through this demo
        </li>
        <li>
          may reference a Private Placement Memorandum or similar materials only as sample or
          placeholder content unless a production issuer separately provides official documents
        </li>
        <li>
          may not be relied upon in making an investment, tax, legal, or financial decision
        </li>
      </ul>
      <p class="is--small">
        <br>
      </p>
    </div>
  </div>
</template>

<style lang="scss">
.v-footer-text {
  $root: &;

  color: var(--ui-color-text-inverse, #fff);
  background-color: var(--ui-color-surface-inverse, #12161f);

  &__list {
    list-style-type: disc;
    list-style-position: inside;
    margin: 5px 3px;
  }

  p, li, ul {
    color: inherit;
  }

  li + li {
    margin-top: 0;
  }

  ul {
    padding-left: 0;
  }
}
</style>
