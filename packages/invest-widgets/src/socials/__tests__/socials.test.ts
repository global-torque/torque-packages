import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import VSocialLinks from '../VSocialLinks.vue';
import { resolveSocialList, socials } from '../socials';

const hostIcon = defineComponent({ template: '<svg aria-hidden="true" />' });

describe('social link host contract', () => {
  it('preserves known host icons, destinations, and share metadata', () => {
    const links = resolveSocialList([{
      ...socials.linkedin,
      iconName: 'linkedin',
      icon: hostIcon,
      href: 'https://host.example/social/linkedin',
    }]);

    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('https://host.example/social/linkedin');
    expect(links[0].shareHref).toBe(socials.linkedin.shareHref);
    expect(links[0].icon).toBe(hostIcon);
  });

  it('preserves custom host network names and string icons', () => {
    const links = resolveSocialList([{
      iconName: 'company-network',
      name: 'Company network',
      icon: '/images/company-network.svg',
      href: 'https://host.example/company-network',
    }]);

    expect(links[0]).toEqual({
      iconName: 'company-network',
      name: 'Company network',
      icon: '/images/company-network.svg',
      href: 'https://host.example/company-network',
    });
  });

  it('renders no anchors when the host supplies no social destinations', () => {
    const wrapper = mount(VSocialLinks, { props: { socialList: [] } });
    expect(wrapper.findAll('a')).toHaveLength(0);
  });
});
