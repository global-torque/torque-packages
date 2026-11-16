import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useVFormComments } from '../useVFormComments.ts';

const state = vi.hoisted(() => ({
  formModel: undefined as undefined | {
    content_type: 'offer.offer';
    object_id: string;
    comment: string;
    related: string;
  },
  getOfferComments: vi.fn(),
  setOfferComment: vi.fn(),
  setOfferCommentOptionsState: {
    value: {
      loading: false,
      data: undefined as undefined | Record<string, unknown>,
    },
  },
  setOfferCommentState: {
    value: {
      loading: false,
      data: undefined as undefined | { id: number },
    },
  },
  submittedPayload: undefined as undefined | {
    content_type: 'offer.offer';
    object_id: string;
    comment: string;
    related: string;
  },
  userLoggedIn: { value: true },
}));

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('vitepress', () => ({
  useRoute: () => ({ path: '/offer/example' }),
}));

vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn(),
}));

vi.mock('@global-torque/invest-data/service/dataClientConfig', () => ({
  getInvestDataAppLinks: () => ({ signin: '/signin' }),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({ userLoggedIn: state.userLoggedIn }),
}));

vi.mock('../../../data/offer.repository.ts', () => ({
  useRepositoryOffer: () => ({
    getOfferComments: state.getOfferComments,
    setOfferComment: state.setOfferComment,
    setOfferCommentOptionsState: state.setOfferCommentOptionsState,
    setOfferCommentState: state.setOfferCommentState,
  }),
}));

vi.mock('@global-torque/ui-kit/form-validation', () => ({
  useFormValidation: (
    _schemaFrontend: unknown,
    _schemaBackend: unknown,
    initialData: typeof state.formModel,
  ) => {
    state.formModel = initialData;

    return {
      model: initialData,
      validation: {},
      isValid: { value: true },
      onValidate: vi.fn(),
      schemaObject: {},
      scrollToError: vi.fn(),
      formErrors: {},
      isFieldRequired: vi.fn(),
      getErrorText: vi.fn(),
      getOptions: vi.fn(() => []),
    };
  },
}));

vi.mock('@global-torque/invest-core/form-validation', () => ({
  composeInvestmentFormSchema: vi.fn(),
  createInvestmentAjv: vi.fn(),
  prepareInvestmentFormData: vi.fn(),
}));

function mountComposable(offerId = 7) {
  let viewModel!: ReturnType<typeof useVFormComments>;

  mount(defineComponent({
    setup() {
      viewModel = useVFormComments(offerId);
      return {};
    },
    template: '<div />',
  }));

  return viewModel;
}

describe('useVFormComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.formModel = undefined;
    state.setOfferCommentState.value.data = undefined;
    state.setOfferCommentOptionsState.value.data = undefined;
    state.submittedPayload = undefined;
    state.setOfferComment.mockImplementation(async (payload) => {
      state.submittedPayload = { ...payload };
      state.setOfferCommentState.value.data = { id: 12 };
    });
  });

  it('submits a generic payload without immediately reloading the public comment list', async () => {
    const viewModel = mountComposable();
    viewModel.model.comment = 'What is the expected return?';

    await viewModel.sendQuestion();

    expect(state.setOfferComment).toHaveBeenCalledOnce();
    expect(state.submittedPayload).toEqual({
      content_type: 'offer.offer',
      object_id: '7',
      comment: 'What is the expected return?',
      related: 'none',
    });
    expect(viewModel.model.comment).toBe('');
    expect(state.getOfferComments).not.toHaveBeenCalled();
  });
});
