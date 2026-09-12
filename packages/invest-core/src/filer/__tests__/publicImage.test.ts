import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  buildPublicFilerImageSource,
  buildPublicFilerImageSrcset,
  buildPublicFilerImageUrl,
  getPublicFilerWidthDescriptor,
} from '../publicImage';

describe('publicImage', () => {
  it('builds public filer image URLs with injected config', () => {
    expect(buildPublicFilerImageUrl(42, 'medium', {
      filerUrl: 'https://filer.example.com',
    })).toBe('https://filer.example.com/public/files/42?size=medium');
  });

  it('passes direct image URLs through without filer config', () => {
    expect(buildPublicFilerImageUrl('https://cdn.example.com/image.png')).toBe('https://cdn.example.com/image.png');
    expect(buildPublicFilerImageUrl('/fallback.svg')).toBe('/fallback.svg');
  });

  it('builds width descriptors and srcsets', () => {
    expect(getPublicFilerWidthDescriptor('484x290')).toBe(323);
    expect(buildPublicFilerImageSrcset(42, {
      filerUrl: 'https://filer.example.com',
    })).toBe([
      'https://filer.example.com/public/files/42?size=small 207w',
      'https://filer.example.com/public/files/42?size=medium 323w',
      'https://filer.example.com/public/files/42?size=big 683w',
    ].join(', '));
  });

  it('falls back when filer config or image id is unavailable', () => {
    expect(buildPublicFilerImageUrl(42)).toBeUndefined();
    expect(buildPublicFilerImageSource(undefined, {
      fallbackSrc: '/fallback.svg',
    })).toBe('/fallback.svg');
  });
});
