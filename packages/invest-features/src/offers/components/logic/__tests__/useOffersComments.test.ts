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
      data: undefined as undefined | { data: Array<{ id: number; comment: string }> },
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

function mountComposable(props = reactive({ loading: false })) {
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
    const props = reactive({ loading: true });
    state.getOfferCommentsState.value = {
      loading: false,
      data: {
        data: [{ id: 1, comment: 'Question' }],
      },
    };

    const viewModel = mountComposable(props);

    expect(viewModel.comments.value).toEqual([{ id: 1, comment: 'Question' }]);
    expect(viewModel.isLoading.value).toBe(true);

    props.loading = false;
    state.setOfferCommentOptionsState.value.loading = true;
    expect(viewModel.isLoading.value).toBe(true);
  });
});
