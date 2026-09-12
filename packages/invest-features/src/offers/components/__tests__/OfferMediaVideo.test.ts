import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfferMediaVideo from '../OfferMediaVideo.vue';

const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe('OfferMediaVideo provider lifetime', () => {
  it('uses Vimeo oEmbed poster and keeps private playback source', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ thumbnail_url: 'https://i.vimeocdn.com/video/poster.jpg' }) });
    vi.stubGlobal('fetch', fetcher);
    const wrapper = mount(OfferMediaVideo, { props: { source: 'https://vimeo.com/12345/privatehash', name: 'Offer' } });
    wrappers.push(wrapper);
    await flushPromises();
    expect(fetcher.mock.calls[0][0]).toContain(encodeURIComponent('https://vimeo.com/12345/privatehash'));
    expect(wrapper.get('img').attributes('src')).toBe('https://i.vimeocdn.com/video/poster.jpg');
    await wrapper.setProps({ active: true });
    expect(wrapper.get('iframe').attributes('src')).toBe('https://player.vimeo.com/video/12345?h=privatehash&controls=1');
    await wrapper.setProps({ active: false });
    expect(wrapper.find('iframe').exists()).toBe(false);
  });

  it.each([{ ok: false, json: async () => ({ thumbnail_url: 'https://test/poster.jpg' }) }, { ok: true, json: async () => ({ thumbnail_url: 'javascript:alert(1)' }) }, { ok: true, json: async () => ({ thumbnail_url: 42 }) }])('retains playback when the poster response is invalid', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    const wrapper = mount(OfferMediaVideo, { props: { source: 'https://vimeo.com/12345', name: 'Offer', active: true } });
    wrappers.push(wrapper);
    await flushPromises();
    expect(wrapper.get('iframe').attributes('src')).toContain('player.vimeo.com/video/12345');
  });

  it('aborts obsolete requests, rejects stale responses and cancels on unmount', async () => {
    let resolveFirst!: (value: unknown) => void;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const fetcher = vi.fn().mockReturnValueOnce(first).mockResolvedValue({ ok: true, json: async () => ({ thumbnail_url: 'https://i.vimeocdn.com/current.jpg' }) });
    vi.stubGlobal('fetch', fetcher);
    const wrapper = mount(OfferMediaVideo, { props: { source: 'https://vimeo.com/11111', name: 'Offer' } });
    await flushPromises();
    const firstSignal = fetcher.mock.calls[0][1].signal as AbortSignal;
    await wrapper.setProps({ source: 'https://vimeo.com/22222' });
    await flushPromises();
    expect(firstSignal.aborted).toBe(true);
    resolveFirst({ ok: true, json: async () => ({ thumbnail_url: 'https://i.vimeocdn.com/stale.jpg' }) });
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe('https://i.vimeocdn.com/current.jpg');
    const secondSignal = fetcher.mock.calls[1][1].signal as AbortSignal;
    wrapper.unmount();
    expect(secondSignal.aborted).toBe(true);
  });
});
