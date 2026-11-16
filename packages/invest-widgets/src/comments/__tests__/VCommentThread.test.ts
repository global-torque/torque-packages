import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { VCommentThread } from '../index.ts';

describe('VCommentThread', () => {
  it('renders the generic comment author name', () => {
    const wrapper = mount(VCommentThread, {
      props: {
        comment: {
          id: 12,
          content_type: 'offer.offer',
          object_id: '7',
          created_at: '2026-11-16T10:00:00Z',
          comment: 'What is the expected return?',
          related: 'none',
          author: {
            first_name: 'Ada',
            last_name: 'Lovelace',
          },
        },
      },
      global: {
        stubs: {
          VComment: {
            props: ['title'],
            template: '<article>{{ title }}</article>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Ada Lovelace');
  });
});
