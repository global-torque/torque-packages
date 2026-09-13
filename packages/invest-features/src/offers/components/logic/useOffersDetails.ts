import { computed, type Ref } from 'vue';
import type { OfferMedia } from './offerMedia';
import { useData } from 'vitepress';
import {
  buildPublicFilerImageSource,
  buildPublicFilerImageSrcset,
  buildPublicFilerImageUrl,
} from '@global-torque/invest-data/filer';
import type { IOfferFormatted } from '@global-torque/domain-types/offerTypes';
import { useOfferFilerFiles } from './useOfferFilerFiles.ts';
import { getInvestDataAppLinks } from '@global-torque/invest-data/service/dataClientConfig';
import {
  socials,
  type SocialLinkDestination,
} from '@global-torque/invest-widgets/socials';

export function useOffersDetails(
  offerRef: Ref<IOfferFormatted | undefined>,
) {
  const { frontmatter } = useData();
  const links = getInvestDataAppLinks();

  const breadcrumbsList = computed(() => [
    {
      text: 'Home',
      href: links.home,
    },
    {
      text: 'Explore',
      href: links.offers,
    },
    {
      text: offerRef.value?.name || 'Offer Details',
    },
  ]);

  const tags = [
    'Fintech',
    'E-Commerce',
    'Network Security',
  ];

  const { filesLoading, mediaImages, mediaReady } = useOfferFilerFiles(offerRef);
  const videoSrc = computed(() => offerRef.value?.data?.video);
  const imageID = computed(() => offerRef.value?.image_link_id as number | undefined);
  const offerMainImageSrc = computed(() => buildPublicFilerImageSource(imageID.value, {
    fallbackSrc: offerRef.value?.imageBig,
    preferredSize: 'big',
  }));
  const offerMainImageSrcset = computed(() => buildPublicFilerImageSrcset(imageID.value));
  const offerMainImageSizes = computed(() => '(max-width: 1024px) 100vw, 66vw');
  const offerThumbSrc = computed(() => buildPublicFilerImageSource(imageID.value, {
    fallbackSrc: offerRef.value?.imageSmall,
    preferredSize: 'small',
  }));
  const offerThumbSrcset = computed(() => buildPublicFilerImageSrcset(imageID.value));
  const offerThumbSizes = computed(() => '150px');
  const carouselFiles = computed(() => {
    const array: OfferMedia[] = [...mediaImages.value];
    if (videoSrc.value) array.unshift({ video: videoSrc.value });
    if (!(array.length === 1 && !!videoSrc.value) && (imageID.value && imageID.value > 0)) {
      array.push({
        image: offerMainImageSrc.value || buildPublicFilerImageUrl(imageID.value, 'big'),
        thumb: offerThumbSrc.value || buildPublicFilerImageUrl(imageID.value, 'small'),
        srcset: offerMainImageSrcset.value || undefined,
        sizes: offerMainImageSizes.value || undefined,
        thumbSrcset: offerThumbSrcset.value || undefined,
        thumbSizes: offerThumbSizes.value || undefined,
      });
    }
    return array;
  });

  // Social links computed property
  const socialLinks = computed<SocialLinkDestination[]>(() => {
    if (!offerRef.value) return [];

    return Object.entries(socials)
      .filter(([key]) => offerRef.value?.[key as keyof typeof offerRef.value])
      .map(([key, config]) => ({
        iconName: config.iconName,
        name: config.name,
        shareHref: config.shareHref,
        href: offerRef.value?.[key as keyof typeof offerRef.value] as string,
      })) as SocialLinkDestination[];
  });

  return {
    frontmatter,
    breadcrumbsList,
    tags,
    carouselFiles,
    socialLinks,
    filesLoading,
    mediaReady,
  };
}
