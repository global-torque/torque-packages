import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import VCommentThread from '../VCommentThread.vue';

describe('VCommentThread', () => {
  it('renders the comment author name', () => {
    const wrapper = mount(VCommentThread, {
      props: {
        comment: {
          id: 17,
          content_type: 'offer.offer',
          object_id: '42',
          created_at: '2026-03-01T00:00:00.000Z',
          comment: 'Can I invest from Illinois?',
          related: 'none',
          author: {
            first_name: 'Ada',
            last_name: 'Lovelace',
          },
        },
      },
      global: {
        stubs: {
          VComment: { props: ['title'], template: '<div>{{ title }}</div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Ada Lovelace');
  });
});
