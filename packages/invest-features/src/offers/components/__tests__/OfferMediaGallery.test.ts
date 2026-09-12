import { flushPromises, mount } from '@vue/test-utils';
import { createSSRApp, h, nextTick, ref } from 'vue';
import { Carousel, type CarouselApi } from '@global-torque/ui-primitives/carousel';
import { renderToString } from 'vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfferMediaGallery from '../OfferMediaGallery.vue';
import OfferMediaImage from '../OfferMediaImage.vue';
import defaultImage from '../../assets/default.svg?url';

const images = [
  { image: '/one.jpg', thumb: '/one-thumb.jpg', srcset: '/one-small.jpg 400w, /one.jpg 900w', sizes: '66vw', thumbSrcset: '/one-thumb.jpg 150w', thumbSizes: '150px' },
  { image: '/two.jpg', thumb: '/two-thumb.jpg' },
  { image: '/three.jpg' },
];
const mounted: ReturnType<typeof mount>[] = [];
function gallery(files = images, ready = true) {
  const wrapper = mount(OfferMediaGallery, { props: { files, ready, name: 'Test offer' } });
  mounted.push(wrapper);
  return wrapper;
}
beforeEach(() => {
  window.history.replaceState({}, '', '/offer?other=keep#details');
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('OfferMediaGallery real carousel composition', () => {
  it('renders actual eager responsive images, independent thumbnails and navigation', async () => {
    const wrapper = gallery();
    await flushPromises();
    const main = wrapper.get('[data-testid="offer-media-main"]');
    expect(main.findAll('[data-slot="carousel-item"]')).toHaveLength(3);
    const image = main.get('img');
    expect(image.attributes()).toMatchObject({ src: '/one.jpg', srcset: images[0].srcset, sizes: '66vw', loading: 'eager' });
    expect(wrapper.get('[aria-label="Show image 1"] img').attributes()).toMatchObject({ src: '/one-thumb.jpg', srcset: images[0].thumbSrcset, sizes: '150px' });
    expect(wrapper.get('[aria-label="Previous media"]')).toBeDefined();
    expect(wrapper.get('[aria-label="Next media"]')).toBeDefined();
    await wrapper.get('[aria-label="Show image 2"]').trigger('click');
    expect(wrapper.attributes('data-selected-index')).toBe('1');
    expect(wrapper.get('[aria-label="Show image 2"]').attributes('aria-current')).toBe('true');
    expect(window.location.search).toBe('?other=keep&media=1');
    expect(window.location.hash).toBe('#details');
  });

  it('uses the entire single-item/empty area and hides all navigation', async () => {
    const wrapper = gallery([images[0]]);
    await flushPromises();
    expect(wrapper.classes()).not.toContain('offer-media-gallery--multiple');
    expect(wrapper.find('[aria-label="Next media"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Choose media"]').exists()).toBe(false);
    await wrapper.setProps({ files: [] });
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(defaultImage);
    expect(wrapper.get('img').attributes('srcset')).toBeUndefined();
  });

  it('does not erase a requested index while the public filer response is pending', async () => {
    window.history.replaceState({}, '', '/offer?media=2&other=keep#details');
    const wrapper = gallery([images[0]], false);
    await flushPromises();
    expect(wrapper.attributes('data-selected-index')).toBe('0');
    expect(window.location.search).toContain('media=2');
    expect(wrapper.get('[data-testid="offer-media-main"]').attributes('inert')).toBeDefined();
    await wrapper.setProps({ files: images, ready: true });
    await flushPromises();
    expect(wrapper.attributes('data-selected-index')).toBe('2');
    expect(wrapper.get('[data-testid="offer-media-main"]').attributes('inert')).toBeUndefined();
    expect(wrapper.get('[aria-label="Show image 3"]').attributes('aria-current')).toBe('true');
  });

  it.each(['', 'invalid', '-1', '1.5', '99'])('resolves invalid initial media=%s to zero after readiness', async (value) => {
    window.history.replaceState({}, '', `/offer?media=${value}&other=keep#details`);
    const wrapper = gallery();
    await flushPromises();
    expect(wrapper.attributes('data-selected-index')).toBe('0');
    expect(window.location.search).toBe('?other=keep');
  });

  it('responds to browser history without adding history entries', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const wrapper = gallery();
    await flushPromises();
    window.history.pushState({}, '', '/offer?other=keep&media=2#details');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await flushPromises();
    expect(wrapper.attributes('data-selected-index')).toBe('2');
    await wrapper.get('[aria-label="Show image 2"]').trigger('click');
    await flushPromises();
    expect(replace).toHaveBeenLastCalledWith({}, '', '/offer?other=keep&media=1#details');
  });

  it('preserves the selected duplicate occurrence through refresh and resets when removed', async () => {
    const duplicate = [images[0], images[1], images[0]];
    const wrapper = gallery(duplicate);
    await flushPromises();
    await wrapper.get('[aria-label="Show image 3"]').trigger('click');
    await wrapper.setProps({ ready: false });
    await wrapper.setProps({ files: [images[2], ...duplicate], ready: true });
    await flushPromises();
    expect(wrapper.attributes('data-selected-index')).toBe('3');
    await wrapper.setProps({ files: [images[0], images[1]] });
    await flushPromises();
    expect(wrapper.attributes('data-selected-index')).toBe('0');
  });

  it('keeps image and thumbnail errors independent and clears responsive fallback attributes', async () => {
    const wrapper = gallery();
    await flushPromises();
    let main = wrapper.get('[data-testid="offer-media-main"] img');
    await main.trigger('error');
    main = wrapper.get('[data-testid="offer-media-main"] img');
    expect(main.attributes('src')).toBe(defaultImage);
    expect(main.attributes('srcset')).toBeUndefined();
    expect(main.attributes('sizes')).toBeUndefined();
    expect(wrapper.get('[aria-label="Show image 1"] img').attributes('src')).toBe('/one-thumb.jpg');
    await main.trigger('error');
    expect(main.attributes('src')).toBe(defaultImage);
  });

  it('does not mount a video before ready, unmounts inactive playback and avoids autoplay when revisited', async () => {
    const wrapper = mount(OfferMediaGallery, { props: { files: [{ video: 'https://youtu.be/dQw4w9WgXcQ' }, images[0]], ready: false } });
    mounted.push(wrapper);
    await flushPromises();
    expect(wrapper.find('iframe').exists()).toBe(false);
    await wrapper.setProps({ ready: true });
    await flushPromises();
    expect(wrapper.get('iframe').attributes('src')).toContain('autoplay=1&mute=1');
    await wrapper.get('[aria-label="Show image 2"]').trigger('click');
    expect(wrapper.find('iframe').exists()).toBe(false);
    await wrapper.get('[aria-label="Show video 1"]').trigger('click');
    expect(wrapper.get('iframe').attributes('src')).not.toContain('autoplay');
    expect(wrapper.findAll('iframe')).toHaveLength(1);
  });

  it('keeps navigation coherent while an already displayed media list refreshes', async () => {
    const wrapper = gallery();
    await flushPromises();
    await wrapper.setProps({ ready: false });
    await flushPromises();
    await wrapper.get('[aria-label="Show image 2"]').trigger('click');
    expect(wrapper.attributes('data-selected-index')).toBe('1');
    expect(wrapper.get('[data-media-index="1"]').attributes('aria-hidden')).toBe('false');
    await wrapper.setProps({ ready: true });
    await flushPromises();
    expect(wrapper.attributes('data-selected-index')).toBe('1');
  });

  it('never mounts a temporarily selected video while media are reordered', async () => {
    const video = { video: 'https://youtu.be/dQw4w9WgXcQ' };
    window.history.replaceState({}, '', '/offer?media=1');
    const wrapper = mount(OfferMediaGallery, { props: { files: [video, images[0]], ready: true } });
    mounted.push(wrapper);
    await flushPromises();
    const created: string[] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) => {
      created.push(tag);
      return create(tag, options);
    }) as typeof document.createElement);
    await wrapper.setProps({ files: [images[0], video] });
    await flushPromises();
    expect(created).not.toContain('iframe');
    expect(wrapper.attributes('data-selected-index')).toBe('0');
  });

  it('preserves the selected player instance across refresh and carousel resize', async () => {
    const wrapper = mount(OfferMediaGallery, { props: { files: [{ video: 'https://youtu.be/dQw4w9WgXcQ' }, images[0]], ready: true } });
    mounted.push(wrapper);
    await flushPromises();
    const player = wrapper.get('iframe').element;
    await wrapper.setProps({ ready: false });
    await flushPromises();
    expect(wrapper.get('iframe').element).toBe(player);
    await wrapper.setProps({ ready: true });
    const api = wrapper.getComponent(Carousel).vm.carouselApi;
    api?.reInit();
    await flushPromises();
    expect(wrapper.get('iframe').element).toBe(player);
  });

  it('detaches listeners from each replaced carousel API and on unmount', async () => {
    const wrapper = gallery();
    await flushPromises();
    const makeApi = () => ({
      on: vi.fn(), off: vi.fn(), reInit: vi.fn(), scrollTo: vi.fn(), selectedScrollSnap: () => 0,
    });
    const first = makeApi();
    const second = makeApi();
    wrapper.getComponent(Carousel).vm.$emit('init-api', first as unknown as CarouselApi);
    await flushPromises();
    wrapper.getComponent(Carousel).vm.$emit('init-api', second as unknown as CarouselApi);
    await flushPromises();
    for (const event of ['select', 'reInit']) {
      expect(first.off).toHaveBeenCalledWith(event, expect.any(Function));
      expect(second.on).toHaveBeenCalledWith(event, expect.any(Function));
    }
    wrapper.unmount();
    for (const event of ['select', 'reInit']) expect(second.off).toHaveBeenCalledWith(event, expect.any(Function));
    mounted.splice(mounted.indexOf(wrapper), 1);
  });

  it('removes the old player and resets selection at a keyed offer boundary', async () => {
    const offer = ref(1);
    const wrapper = mount({ setup: () => () => h(OfferMediaGallery, { key: offer.value, files: offer.value === 1 ? [{ video: 'https://youtu.be/dQw4w9WgXcQ' }, images[0]] : [images[1]], ready: true }) });
    mounted.push(wrapper);
    await flushPromises();
    const player = wrapper.get('iframe').element;
    window.history.replaceState({}, '', '/second-offer');
    offer.value = 2;
    await flushPromises();
    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(wrapper.element.contains(player)).toBe(false);
    expect(wrapper.get('[data-testid="offer-media-gallery"]').attributes('data-selected-index')).toBe('0');
  });

  it('renders the same slide through SSR hydration before applying the URL', async () => {
    window.history.replaceState({}, '', '/offer?media=1');
    const props = { files: images, name: 'Hydrated offer', ready: true };
    const html = await renderToString(createSSRApp({ render: () => h(OfferMediaGallery, props) }));
    expect(html).toContain('data-selected-index="0"');
    const target = document.createElement('div');
    target.innerHTML = html;
    document.body.appendChild(target);
    const errors = vi.spyOn(console, 'error');
    const app = createSSRApp({ render: () => h(OfferMediaGallery, props) });
    app.mount(target);
    await flushPromises();
    expect(target.querySelector('[data-testid="offer-media-gallery"]')?.getAttribute('data-selected-index')).toBe('1');
    expect(errors.mock.calls.flat().join(' ')).not.toContain('Hydration');
    app.unmount();
    target.remove();
  });
});

describe('OfferMediaImage lifecycle', () => {
  it('recognizes cached decoded images and resets failures when responsive sources change', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(120);
    const wrapper = mount(OfferMediaImage, { props: { src: '/old.jpg', srcset: '/old.jpg 120w', sizes: '120px', alt: 'Offer' } });
    mounted.push(wrapper);
    await nextTick();
    expect(wrapper.attributes('aria-busy')).toBe('false');
    await wrapper.get('img').trigger('error');
    expect(wrapper.attributes('data-fallback')).toBe('true');
    await wrapper.setProps({ src: '/new.jpg', srcset: '/new.jpg 120w' });
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe('/new.jpg');
    expect(wrapper.get('img').attributes('srcset')).toBe('/new.jpg 120w');
    expect(wrapper.attributes('aria-busy')).toBe('false');
  });
});
