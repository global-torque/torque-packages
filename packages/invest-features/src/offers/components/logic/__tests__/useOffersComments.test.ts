import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, reactive } from 'vue';
import { useOffersComments } from '../useOffersComments.ts';

const state = vi.hoisted(() => ({
  getOfferCommentsState: {
    value: {
      loading: false,
      data: undefined as undefined | {
        data: Array<{ id: number; object_id: string; comment: string }>;
      },
    },
  },
  setOfferCommentOptionsState: {
    value: {
      loading: false,
      data: undefined as undefined | Record<string, unknown>,
    },
  },
  setOfferCommentOptions: vi.fn(),
}));

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('../../../data/offer.repository.ts', () => ({
  useRepositoryOffer: () => ({
    getOfferCommentsState: state.getOfferCommentsState,
    setOfferCommentOptionsState: state.setOfferCommentOptionsState,
    setOfferCommentOptions: state.setOfferCommentOptions,
  }),
}));

function mountComposable(props = reactive({ loading: false, offerId: 42 })) {
  let viewModel!: ReturnType<typeof useOffersComments>;

  mount(defineComponent({
    setup() {
      viewModel = useOffersComments(props);
      return {};
    },
    template: '<div />',
  }));

  return viewModel;
}

describe('useOffersComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getOfferCommentsState.value = {
      loading: false,
      data: undefined,
    };
    state.setOfferCommentOptionsState.value = {
      loading: false,
      data: undefined,
    };
    state.setOfferCommentOptions.mockResolvedValue(undefined);
  });

  it('loads comment options when backend schema is missing', async () => {
    mountComposable();
    await flushPromises();

    expect(state.setOfferCommentOptions).toHaveBeenCalledTimes(1);
  });

  it('exposes comments and merged loading state', () => {
    const props = reactive({ loading: true, offerId: 42 });
    state.getOfferCommentsState.value = {
      loading: false,
        data: {
        data: [{ id: 1, object_id: '42', comment: 'Question' }],
      },
    };

    const viewModel = mountComposable(props);

    expect(viewModel.comments.value).toEqual([
      { id: 1, object_id: '42', comment: 'Question' },
    ]);
    expect(viewModel.isLoading.value).toBe(true);

    props.loading = false;
    state.setOfferCommentOptionsState.value.loading = true;
    expect(viewModel.isLoading.value).toBe(true);
  });

  it('filters comments to the active offer and merges submitted comments by ID', () => {
    const props = reactive({ loading: false, offerId: 42 });
    state.getOfferCommentsState.value = {
      loading: false,
      data: {
        data: [
          { id: 1, object_id: '41', comment: 'Other offer' },
          { id: 2, object_id: '42', comment: 'Existing question' },
        ],
      },
    };

    const viewModel = mountComposable(props);

    expect(viewModel.comments.value).toEqual([
      { id: 2, object_id: '42', comment: 'Existing question' },
    ]);

    viewModel.addSubmittedComment({
      id: 2,
      object_id: '42',
      comment: 'Updated question',
    });
    viewModel.addSubmittedComment({
      id: 3,
      object_id: '42',
      comment: 'New question',
    });

    expect(viewModel.comments.value).toEqual([
      { id: 2, object_id: '42', comment: 'Updated question' },
      { id: 3, object_id: '42', comment: 'New question' },
    ]);

    props.offerId = 43;
    expect(viewModel.comments.value).toEqual([]);
  });
});
