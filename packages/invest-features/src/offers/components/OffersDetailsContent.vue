<script setup lang="ts">
import { PropType, computed } from 'vue';
import { IOfferFormatted } from '@global-torque/domain-types/offerTypes';
import { TabsContent, TabsList, TabsTrigger } from '@global-torque/ui-primitives/tabs';
import { VUrlSyncedTabs } from '@global-torque/ui-kit/url-synced-tabs';
import OffersDocuments from './OffersDocuments.vue';
import { useOffersDetailsContent } from './logic/useOffersDetailsContent.ts';
import { useOfferSignIn } from './logic/useOfferSignIn.ts';
import OffersComments from './OffersComments.vue';
import { Button } from '@global-torque/ui-primitives/button';

// const OffersComments = defineAsyncComponent({
//   loader: () => import('./OffersComments.vue'),
// });

const props = defineProps({
  offer: {
    type: Object as PropType<IOfferFormatted>,
    required: true,
  },
  loading: Boolean,
  transactional: {
    type: Boolean,
    default: false,
  },
});

const offerRef = computed(() => props.offer);
const {
  userLoggedIn,
  filesFormatted,
  folders,
  tableHeader,
  isFilesLoading,
  isOnline,
  parsedDescription,
  parsedHighlights,
  parsedRiskDisclosures,
  OfferTabTypes,
  tabOptions,
  compactTabs,
} = useOffersDetailsContent(offerRef);

const { signIn } = useOfferSignIn();

</script>

<template>
  <VUrlSyncedTabs
    :variant="compactTabs ? 'default' : 'line'"
    :default-value="tabOptions[0].value"
    class="OffersDetailsContent offer-details-content with-default-distance"
  >
    <TabsList
      class="offer-details-content__tabs-list"
    >
      <TabsTrigger
        v-for="(tab, tabIndex) in tabOptions"
        :key="tabIndex"
        :value="tab.value"
      >
        {{ tab.label }}
        <template
          v-if="tab.subTitle"
          #subtitle
        >
          {{ tab.subTitle }}
        </template>
      </TabsTrigger>
    </TabsList>

    <TabsContent
      :value="OfferTabTypes.description"
      class="tab offer-details-content__description"
    >
      <div class="offer-details-content__title is--h2__title">
        Description
      </div>
      <p
        v-if="offer.description"
        v-dompurify-html="parsedDescription"
        itemprop="description"
        class="offer-details-content__content-text is--body"
      />
    </TabsContent>

    <TabsContent
      :value="OfferTabTypes.highlights"
      class="offer-highlights tab offer-details-content__highlights"
    >
      <div class="offer-details-content__title is--h2__title">
        Highlights
      </div>
      <p
        v-if="offer.highlights"
        v-dompurify-html="parsedHighlights"
        class="offer-details-content__content-text is--body"
      />
    </TabsContent>

    <TabsContent
      v-if="offer.risk_disclosures"
      :value="OfferTabTypes.risk_disclosures"
      class="offer-risk tab offer-details-content__risk"
    >
      <div class="offer-details-content__title is--h2__title">
        Risks
      </div>
      <p
        v-dompurify-html="parsedRiskDisclosures"
        class="offer-details-content__content-text is--body"
      />
    </TabsContent>

    <TabsContent
      :value="OfferTabTypes.documents"
      class="offer-documents tab offer-details-content__documents"
    >
      <div class="offer-details-content__title is--h2__title">
        Financial Documents
      </div>
      <OffersDocuments
        v-if="userLoggedIn"
        :files="filesFormatted"
        :folders="folders"
        :table-header="tableHeader"
        :loading-table="isFilesLoading"
        :online="isOnline"
      />
      <div
        v-else-if="transactional"
        class="offer-details-content__signin-wrap"
      >
        <span class="is--body">
          Please log in to be able to see documents
        </span>
        <Button
          class="is--margin-top-0"
          @click="signIn"
        >
          Log in
        </Button>
      </div>
    </TabsContent>
    <TabsContent
      :value="OfferTabTypes.comments"
    >
      <OffersComments
        :offer-id="offer.id"
        :offer-name="offer.name"
        :loading="loading"
        :allow-submission="transactional"
      />
    </TabsContent>
  </VUrlSyncedTabs>
</template>

<style lang="scss">
.offer-details-content {
  color: var(--foreground);

  @media screen and (min-width: 980px){
    margin-bottom: 40px;
  }

  @media screen and (width < 768px) {
      margin-top: 24px !important;
  }

  &__title {
    margin-bottom: 24px;
  }

  &__signin-wrap {
    display: flex;
    align-items: center;
    width: 100%;
    justify-content: space-between;
  }

  &__content-text {
    width: 100%;
    overflow: auto;
  }

  &__date-header {
    width: 130px;
  }

  &__tabs-list {
    @media screen and (width < 768px) {
      margin: 0 auto;
    }
  }

  h1, h2, h3, h4, h5, h6 {
    color: var(--foreground);
  }

  hr {
    margin: 40px 0;
  }
}
</style>
