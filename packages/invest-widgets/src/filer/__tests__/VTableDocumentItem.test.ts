import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import VTableDocumentItem from '../VTableDocumentItem.vue';

const document = {
  id: 7,
  key: 'private:7',
  access: 'private' as const,
  actionUrl: 'https://files.example.test/auth/files/7',
  category: 'agreement',
  date: '7/22/2026',
  dateTimestamp: Date.parse('2026-07-22T00:00:00Z'),
  isNew: false,
  name: 'Subscription agreement.pdf',
  typeFormatted: 'Agreement',
};

const mountItem = (online = true) => mount(VTableDocumentItem, {
  props: { data: document, online },
  global: {
    directives: { highlight: () => undefined },
    stubs: {
      VTableRow: { template: '<div><slot /></div>' },
      VTableCell: { template: '<div><slot /></div>' },
      VBadge: { template: '<span><slot /></span>' },
      VTooltip: { template: '<span><slot /><slot name="content" /></span>' },
    },
  },
});

describe('VTableDocumentItem', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
  });

  it('renders an icon-only action with a title and a specific accessible name', () => {
    const wrapper = mountItem();
    const name = wrapper.get('.v-table-document-item__name');
    const action = wrapper.get('.v-table-document-item__action');
    expect(name.attributes()).toMatchObject({
      href: document.actionUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': `Open document ${document.name}`,
    });
    expect(action.text()).toBe('');
    expect(action.find('.v-table-document-item__download-icon').exists()).toBe(true);
    expect(action.attributes()).toMatchObject({
      href: document.actionUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': `Open document ${document.name}`,
      title: 'Open document',
    });
  });

  it('disables document actions with an offline explanation', async () => {
    const wrapper = mountItem(false);
    const links = [
      wrapper.get('.v-table-document-item__name'),
      wrapper.get('.v-table-document-item__action'),
    ];
    for (const link of links) {
      expect(link.attributes('href')).toBeUndefined();
      expect(link.attributes('aria-disabled')).toBe('true');
      expect(link.attributes('tabindex')).toBe('-1');
      expect(link.attributes('title')).toContain('unavailable while offline');
      await link.trigger('click');
    }
  });
});
