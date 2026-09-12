import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import OffersDetails from '../OffersDetails.vue';

vi.mock('vitepress', () => ({
  useData: () => ({ frontmatter: ref({ slug: 'offers' }) }),
}));

vi.mock('@webdevelop-pro/invest-data/filer', () => ({
  buildPublicFilerImageSource: () => undefined,
  buildPublicFilerImageSrcset: () => undefined,
  buildPublicFilerImageUrl: () => undefined,
}));

vi.mock('@webdevelop-pro/invest-data/service/dataClientConfig', () => ({
  getInvestDataAppLinks: () => ({ home: '/', offers: '/offers' }),
}));

vi.mock('../logic/useOfferFilerFiles.ts', () => ({
  useOfferFilerFiles: () => ({
    filesLoading: { value: false },
    mediaImages: { value: [] },
    mediaReady: { value: true },
  }),
}));

vi.mock('@webdevelop-pro/invest-runtime/loader', () => ({
  useGlobalLoader: () => ({ hide: vi.fn() }),
}));

vi.mock('@global-torque/ui-primitives/skeleton', () => ({
  Skeleton: { name: 'Skeleton', template: '<div data-testid="skeleton" />' },
}));

vi.mock('@webdevelop-pro/invest-widgets/navigation', () => ({
  VBreadcrumbs: { name: 'VBreadcrumbs', template: '<nav data-testid="breadcrumbs" />' },
}));

vi.mock('../OfferMediaGallery.vue', () => ({
  default: { name: 'OfferMediaGallery', template: '<div data-testid="media-gallery" />' },
}));

vi.mock('../OffersDetailsSide.vue', () => ({
  default: { name: 'OfferDetailsSide', template: '<aside data-testid="offer-side" />' },
}));

vi.mock('../OffersDetailsContent.vue', () => ({
  default: { name: 'OffersDetailsContent', template: '<section data-testid="offer-content" />' },
}));

const SocialLinksStub = vi.hoisted(() => ({
  name: 'VSocialLinks',
  props: {
    socialList: {
      type: Array,
      required: true,
    },
  },
  template: `
    <div data-testid="social-links">
      <a
        v-for="item in socialList"
        :key="item.iconName"
        :href="item.href"
      >
        <component :is="item.icon" />
      </a>
    </div>
  `,
}));

vi.mock('@webdevelop-pro/invest-widgets/socials', () => ({
  socials: {
    linkedin: { iconName: 'linkedin', name: 'LinkedIn' },
    facebook: { iconName: 'facebook', name: 'Facebook' },
    instagram: { iconName: 'instagram', name: 'Instagram' },
    twitter: { iconName: 'twitter', name: 'Twitter' },
    github: { iconName: 'github', name: 'Github' },
  },
  VSocialLinks: SocialLinksStub,
}));

const createIcon = (name: string) => defineComponent({
  name,
  template: `<span data-icon="${name}" />`,
});

const linkedinInitialIcon = createIcon('linkedin-initial');
const linkedinReplacementIcon = createIcon('linkedin-replacement');
const githubReplacementIcon = createIcon('github-replacement');

const createSocialIcons = (linkedin: typeof linkedinInitialIcon, github: typeof githubReplacementIcon) => ({
  linkedin,
  facebook: linkedin,
  instagram: linkedin,
  twitter: linkedin,
  github,
});

describe('OffersDetails social icon ownership', () => {
  it('joins current props icons with the current offer destinations', async () => {
    const wrapper = mount(OffersDetails, {
      props: {
        offer: {
          id: 1,
          name: 'Initial offer',
          linkedin: 'https://host.example/initial-linkedin',
        },
        loading: false,
        socialIcons: createSocialIcons(linkedinInitialIcon, linkedinInitialIcon),
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="social-links"] a').attributes('href'))
      .toBe('https://host.example/initial-linkedin');
    expect(wrapper.find('[data-icon="linkedin-initial"]').exists()).toBe(true);

    await wrapper.setProps({
      socialIcons: createSocialIcons(linkedinReplacementIcon, githubReplacementIcon),
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="social-links"] a').attributes('href'))
      .toBe('https://host.example/initial-linkedin');
    expect(wrapper.find('[data-icon="linkedin-replacement"]').exists()).toBe(true);

    await wrapper.setProps({
      offer: {
        id: 2,
        name: 'Replacement offer',
        github: 'https://host.example/replacement-github',
      },
    });
    await flushPromises();

    const links = wrapper.findAll('[data-testid="social-links"] a');
    expect(links).toHaveLength(1);
    expect(links[0]?.attributes('href')).toBe('https://host.example/replacement-github');
    expect(wrapper.find('[data-icon="github-replacement"]').exists()).toBe(true);
    expect(wrapper.find('[data-icon="linkedin-replacement"]').exists()).toBe(false);
  });
});
