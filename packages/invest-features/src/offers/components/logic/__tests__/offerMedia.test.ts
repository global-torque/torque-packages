import { describe, expect, it } from 'vitest';
import { normalizeOfferVideo } from '../offerMedia';

describe('provider source normalization', () => {
  it.each(['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" onload="evil()"></iframe>'])('normalizes only a supported YouTube source: %s', (source) => {
    expect(normalizeOfferVideo(source)?.embed).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });
  it.each(['https://vimeo.com/12345/privatehash', 'https://player.vimeo.com/video/12345?h=privatehash', '<iframe src="https://player.vimeo.com/video/12345?h=privatehash&amp;autoplay=1"></iframe>'])('retains the Vimeo privacy hash: %s', (source) => {
    expect(normalizeOfferVideo(source)).toMatchObject({ embed: 'https://player.vimeo.com/video/12345?h=privatehash', page: 'https://vimeo.com/12345/privatehash' });
  });
  it.each(['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://user:password@youtube.com/watch?v=dQw4w9WgXcQ', '<iframe src="https://example.com" data-src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>', '<iframe src="https://example.com" title="a src=\'https://www.youtube.com/embed/dQw4w9WgXcQ\'"></iframe>', '<iframe data-src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>', 'https://vimeo.com/12345/invalid%22hash'])('rejects unsafe or unsupported input: %s', (source) => {
    expect(normalizeOfferVideo(source)).toBeNull();
  });
});
