import { computed, onBeforeMount } from 'vue';
import { storeToRefs } from 'pinia';
import type { IOfferComment } from '@global-torque/domain-types/offerTypes';
import { useRepositoryOffer } from '../../data/offer.repository.ts';

type UseOffersCommentsProps = {
  loading?: boolean;
};

export function useOffersComments(props: UseOffersCommentsProps) {
  const offerRepository = useRepositoryOffer();
  const { getOfferCommentsState, setOfferCommentOptionsState } = storeToRefs(offerRepository);

  const comments = computed<IOfferComment[]>(() => getOfferCommentsState.value.data?.data || []);
  const isLoading = computed(() => (
    props.loading || getOfferCommentsState.value.loading || setOfferCommentOptionsState.value.loading
  ));

  onBeforeMount(() => {
    if (!setOfferCommentOptionsState.value.data) {
      void offerRepository.setOfferCommentOptions();
    }
  });

  return {
    comments,
    isLoading,
  };
}
