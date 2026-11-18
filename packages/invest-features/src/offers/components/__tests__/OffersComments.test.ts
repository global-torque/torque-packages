import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import OffersComments from '../OffersComments.vue';

const commentsViewModel = vi.hoisted(() => ({
  comments: undefined as ReturnType<typeof ref> | undefined,
  isLoading: undefined as ReturnType<typeof ref> | undefined,
  commentsLoading: undefined as ReturnType<typeof ref> | undefined,
  addSubmittedComment: vi.fn(),
}));

vi.mock('../logic/useOffersComments.ts', () => ({
  useOffersComments: () => commentsViewModel,
}));

vi.mock('../VFormComments.vue', () => ({
  default: defineComponent({
    name: 'VFormComments',
    emits: ['submit-state', 'submitted'],
    template: '<button data-testid="submit-form" />',
  }),
}));

vi.mock('@global-torque/invest-widgets/comments/VCommentItems.vue', () => ({
  default: defineComponent({
    name: 'VCommentItems',
    props: {
      comments: { type: Array, required: true },
      loading: { type: Boolean, default: false },
    },
    template: '<div data-testid="comment-items" />',
  }),
}));

vi.mock('@global-torque/ui-primitives/skeleton', () => ({
  Skeleton: defineComponent({
    inheritAttrs: false,
    template: '<div data-testid="pending-skeleton" v-bind="$attrs" />',
  }),
}));

describe('OffersComments submission state', () => {
  it('renders one accessible pending skeleton and hides the empty state', async () => {
    commentsViewModel.comments = ref([]);
    commentsViewModel.isLoading = ref(false);
    commentsViewModel.commentsLoading = ref(false);
    const wrapper = mount(OffersComments, {
      props: {
        offerId: 42,
        offerName: 'Example offer',
        allowSubmission: true,
      },
    });

    const form = wrapper.findComponent({ name: 'VFormComments' });
    form.vm.$emit('submit-state', true);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="status"]').attributes()).toMatchObject({
      'aria-live': 'polite',
      'aria-label': 'Posting your question',
    });
    expect(wrapper.findAll('[data-testid="pending-skeleton"]')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('There are no questions yet');

    const submittedComment = { id: 17, object_id: '42' };
    form.vm.$emit('submitted', submittedComment);
    expect(commentsViewModel.addSubmittedComment).toHaveBeenCalledWith(submittedComment);

    form.vm.$emit('submit-state', false);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="status"]').exists()).toBe(false);

    form.vm.$emit('submit-state', true);
    await wrapper.setProps({ allowSubmission: false });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });
});
