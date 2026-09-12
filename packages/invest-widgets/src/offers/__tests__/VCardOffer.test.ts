import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import VCardOffer from '../VCardOffer.vue';

describe('VCardOffer', () => {
  const getDetails = (wrapper: ReturnType<typeof mount>) => wrapper
    .findAll('.v-offer-card__details')
    .map(detail => detail.text());

  it('uses the configured action label and defaults to Invest Now', () => {
    const createWrapper = (actionLabel?: string) => mount(VCardOffer, {
      props: {
        offer: {
          id: 1,
          slug: 'example-offer',
          title: 'Example offer',
          actionLabel,
        },
      },
      global: {
        stubs: {
          VButton: { template: '<button><slot /></button>' },
        },
      },
    });

    expect(createWrapper('View Offer').get('button').text()).toBe('View Offer');
    expect(createWrapper().get('button').text()).toBe('Invest Now');
  });

  it('uses loaded-card proportions for the loading skeleton', () => {
    const wrapper = mount(VCardOffer, {
      global: {
        stubs: {
          VButton: {
            template: '<button><slot /></button>',
          },
          VSkeleton: defineComponent({
            name: 'VSkeleton',
            props: {
              height: { type: String, default: undefined },
              width: { type: String, default: undefined },
            },
            template: '<div :class="$attrs.class" :data-height="height" :data-width="width" />',
          }),
        },
      },
    });

    expect(wrapper.get('.v-offer-card__img.is--img-skeleton').attributes('style')).toContain('height: auto');
    expect(wrapper.get('.v-offer-card__title').attributes('style')).toContain('height: 72px');
    expect(wrapper.findAll('.v-offer-card__info')).toHaveLength(2);
    expect(wrapper.findAll('.v-offer-card__details')).toHaveLength(4);
  });

  it('keeps image selection, responsive attributes and loading priority on the real image', async () => {
    const wrapper = mount(VCardOffer, {
      props: {
        offer: {
          slug: 'image-offer',
          imageSrc: '/offer.webp',
          imageSrcset: '/offer.webp 640w, /offer-large.webp 1280w',
          imageSizes: '(min-width: 980px) 450px, 100vw',
        },
      },
    });
    expect(wrapper.findAll('img')).toHaveLength(1);
    expect(wrapper.get('img').attributes()).toMatchObject({
      src: '/offer.webp',
      srcset: '/offer.webp 640w, /offer-large.webp 1280w',
      sizes: '(min-width: 980px) 450px, 100vw',
      alt: 'image-offer',
      loading: 'lazy',
      fetchpriority: 'auto',
    });
    await wrapper.setProps({
      imageLoading: 'eager',
      offer: { imageMedium: '/fallback.svg', isDefaultImage: true },
    });
    expect(wrapper.get('img').attributes()).toMatchObject({
      src: '/fallback.svg', alt: 'offer image', loading: 'eager', fetchpriority: 'high',
    });
    expect(wrapper.get('img').attributes('srcset')).toBeUndefined();
    expect(wrapper.get('img').attributes('sizes')).toBeUndefined();
    expect(wrapper.get('.v-image').classes()).toContain('is--default-image');
    await wrapper.setProps({ offer: undefined });
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.v-offer-card__image-frame').exists()).toBe(false);
    expect(wrapper.find('.v-offer-card__img.is--img-skeleton').exists()).toBe(true);
  });

  it('shows share price instead of target raise for open-ended offers', () => {
    const wrapper = mount(VCardOffer, {
      props: {
        offer: {
          name: 'Open-ended fund',
          minInvestmentFormatted: '$1,000',
          targetRaiseFormatted: '-',
          pricePerShareFormatted: '$10.00',
          securityTypeFormatted: 'Equity',
          votingRightsFormatted: '1 Vote per Share',
          isOpenEnded: true,
          isSecurityTypeEquity: true,
        },
      },
    });

    const details = getDetails(wrapper);
    expect(details).toContain('Share Price:$10.00');
    expect(details.some(detail => detail.startsWith('Target Raise:'))).toBe(false);
  });

  it('keeps target raise for closed-ended equity offers', () => {
    const wrapper = mount(VCardOffer, {
      props: {
        offer: {
          name: 'Closed-ended fund',
          minInvestmentFormatted: '$1,000',
          targetRaiseFormatted: '$1,000,000',
          pricePerShareFormatted: '$10.00',
          securityTypeFormatted: 'Equity',
          votingRightsFormatted: '1 Vote per Share',
          isOpenEnded: false,
          isSecurityTypeEquity: true,
        },
      },
    });

    const details = getDetails(wrapper);
    expect(details).toContain('Target Raise:$1,000,000');
    expect(details.some(detail => detail.startsWith('Share Price:'))).toBe(false);
  });
});
