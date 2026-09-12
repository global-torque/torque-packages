import { effectScope, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { IOfferFormatted } from '@webdevelop-pro/domain-types/offerTypes';
import { useOffersDetails } from '../useOffersDetails';

vi.mock('vitepress', () => ({ useData: () => ({ frontmatter: ref({}) }) }));
vi.mock('@webdevelop-pro/invest-data/service/dataClientConfig', () => ({ getInvestDataAppLinks: () => ({ home: '/', offers: '/offers' }) }));
vi.mock('@webdevelop-pro/invest-widgets/socials', () => ({
  socials: {
    linkedin: { iconName: 'linkedin', name: 'LinkedIn', shareHref: 'https://linkedin.example/share?url=' },
    facebook: { iconName: 'facebook', name: 'Facebook', shareHref: 'https://facebook.example/share?u=' },
    instagram: { iconName: 'instagram', name: 'Instagram' },
    twitter: { iconName: 'twitter', name: 'Twitter', shareHref: 'https://twitter.example/share?url=' },
    github: { iconName: 'github', name: 'Github' },
  },
}));
vi.mock('@webdevelop-pro/invest-data/filer', () => ({ buildPublicFilerImageSource: (id: number, options: { preferredSize: string }) => `/primary/${id}/${options.preferredSize}`, buildPublicFilerImageSrcset: () => '/small.jpg 400w, /big.jpg 900w', buildPublicFilerImageUrl: () => '/primary.jpg' }));
const publicMedia = ref<{ image: string }[]>([]);
vi.mock('../useOfferFilerFiles', () => ({ useOfferFilerFiles: () => ({ mediaImages: publicMedia, filesLoading: ref(false), mediaReady: ref(true) }) }));

describe('useOffersDetails media inputs', () => {
  it('preserves video, unsorted public media, primary-image ordering and responsive sources', () => {
    publicMedia.value = [{ image: '/public/9' }, { image: '/public/2' }];
    const scope = effectScope();
    const result = scope.run(() => useOffersDetails(ref({ id: 1, image_link_id: 10, data: { video: 'https://youtu.be/dQw4w9WgXcQ' } } as IOfferFormatted)))!;
    expect(result.carouselFiles.value).toEqual([
      { video: 'https://youtu.be/dQw4w9WgXcQ' }, { image: '/public/9' }, { image: '/public/2' },
      { image: '/primary/10/big', thumb: '/primary/10/small', srcset: '/small.jpg 400w, /big.jpg 900w', sizes: '(max-width: 1024px) 100vw, 66vw', thumbSrcset: '/small.jpg 400w, /big.jpg 900w', thumbSizes: '150px' },
    ]);
    scope.stop();
  });
  it('keeps the existing video-only rule suppressing the primary image', () => {
    publicMedia.value = [];
    const scope = effectScope();
    const result = scope.run(() => useOffersDetails(ref({ id: 1, image_link_id: 10, data: { video: 'https://vimeo.com/12345' } } as IOfferFormatted)))!;
    expect(result.carouselFiles.value).toEqual([{ video: 'https://vimeo.com/12345' }]);
    scope.stop();
  });

  it('returns social metadata while retaining offer destinations', () => {
    const scope = effectScope();
    const result = scope.run(() => useOffersDetails(ref({
      id: 1,
      linkedin: 'https://host.example/linkedin',
      github: 'https://host.example/github',
    } as IOfferFormatted)))!;

    expect(result.socialLinks.value).toEqual([
      {
        iconName: 'linkedin',
        name: 'LinkedIn',
        shareHref: 'https://linkedin.example/share?url=',
        href: 'https://host.example/linkedin',
      },
      {
        iconName: 'github',
        name: 'Github',
        shareHref: undefined,
        href: 'https://host.example/github',
      },
    ]);
    scope.stop();
  });
});
