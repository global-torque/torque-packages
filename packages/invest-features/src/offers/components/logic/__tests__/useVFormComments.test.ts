import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive, ref } from 'vue';
import { useVFormComments } from '../useVFormComments.ts';

const mocks = vi.hoisted(() => ({
  getOfferComments: vi.fn(),
  setOfferComment: vi.fn(),
  onValidate: vi.fn(),
  scrollToError: vi.fn(),
  setOfferCommentState: {
    value: { data: { id: 17 }, error: null },
  },
  setOfferCommentOptionsState: {
    value: { data: undefined, error: null },
  },
}));

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store,
}));

vi.mock('../../../data/offer.repository.ts', () => ({
  useRepositoryOffer: () => ({
    getOfferComments: mocks.getOfferComments,
    setOfferComment: mocks.setOfferComment,
    setOfferCommentState: mocks.setOfferCommentState,
    setOfferCommentOptionsState: mocks.setOfferCommentOptionsState,
  }),
}));

vi.mock('@global-torque/ui-kit/form-validation', () => ({
  useFormValidation: (_schemaFrontend: unknown, _schemaBackend: unknown, initialModel: object) => ({
    model: reactive({ ...initialModel, comment: '' }),
    validation: ref({}),
    isValid: ref(true),
    onValidate: mocks.onValidate,
    schemaObject: ref({}),
    scrollToError: mocks.scrollToError,
    formErrors: ref({}),
    isFieldRequired: vi.fn(),
    getErrorText: vi.fn(),
    getOptions: vi.fn(),
  }),
}));

vi.mock('@global-torque/invest-core/form-validation', () => ({
  composeInvestmentFormSchema: vi.fn(),
  createInvestmentAjv: vi.fn(),
  prepareInvestmentFormData: vi.fn(),
}));

vi.mock('@global-torque/invest-data/service/dataClientConfig', () => ({
  getInvestDataAppLinks: () => ({ signin: '/sign-in' }),
}));

vi.mock('@global-torque/invest-runtime/navigation', () => ({
  navigateWithQueryParams: vi.fn(),
}));

vi.mock('@global-torque/invest-runtime/session', () => ({
  useSessionStore: () => ({ userLoggedIn: ref(true) }),
}));

vi.mock('vitepress', () => ({
  useRoute: () => ({ path: '/offer/example' }),
}));

describe('useVFormComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setOfferComment.mockResolvedValue(undefined);
    mocks.setOfferCommentState.value = { data: { id: 17 }, error: null };
    mocks.setOfferCommentOptionsState.value = { data: undefined, error: null };
  });

  it('submits the generic target, clears on success, and waits for moderation before reloading', async () => {
    let submittedPayload: Record<string, unknown> | undefined;
    mocks.setOfferComment.mockImplementation(async (payload) => {
      submittedPayload = { ...payload };
    });
    const viewModel = useVFormComments(42);
    viewModel.model.comment = 'Can I invest from Illinois?';

    await viewModel.sendQuestion();

    expect(submittedPayload).toEqual({
      content_type: 'offer.offer',
      object_id: '42',
      comment: 'Can I invest from Illinois?',
      related: 'none',
    });
    expect(viewModel.model.comment).toBe('');
    expect(mocks.getOfferComments).not.toHaveBeenCalled();
  });
});
