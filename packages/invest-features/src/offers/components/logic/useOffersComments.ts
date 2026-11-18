import { computed, onBeforeMount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { IOfferComment } from '@global-torque/domain-types/offerTypes';
import { useRepositoryOffer } from '../../data/offer.repository.ts';

type UseOffersCommentsProps = {
  offerId: number;
  loading?: boolean;
};

export function useOffersComments(props: UseOffersCommentsProps) {
  const offerRepository = useRepositoryOffer();
  const { getOfferCommentsState, setOfferCommentOptionsState } = storeToRefs(offerRepository);
  const submittedComments = ref(new Map<number, IOfferComment>());

  const comments = computed<IOfferComment[]>(() => {
    const offerObjectId = String(props.offerId);
    const mergedComments = new Map<number, IOfferComment>();
    const loadedComments = getOfferCommentsState.value.data?.data || [];

    loadedComments
      .filter(comment => comment.object_id === offerObjectId)
      .forEach(comment => mergedComments.set(comment.id, comment));
    submittedComments.value.forEach((comment) => {
      if (comment.object_id === offerObjectId) {
        mergedComments.set(comment.id, comment);
      }
    });

    return [...mergedComments.values()];
  });
  const commentsLoading = computed(() => (
    props.loading
    || getOfferCommentsState.value.loading
    || (setOfferCommentOptionsState.value.loading && comments.value.length === 0)
  ));
  const isLoading = computed(() => (
    props.loading || getOfferCommentsState.value.loading || setOfferCommentOptionsState.value.loading
  ));

  const addSubmittedComment = (comment: IOfferComment) => {
    if (comment.object_id !== String(props.offerId)) return;
    const nextComments = new Map(submittedComments.value);
    nextComments.set(comment.id, comment);
    submittedComments.value = nextComments;
  };

  onBeforeMount(() => {
    if (!setOfferCommentOptionsState.value.data) {
      void offerRepository.setOfferCommentOptions();
    }
  });

  return {
    comments,
    commentsLoading,
    isLoading,
    addSubmittedComment,
  };
}
