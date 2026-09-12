import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  resetInvestDataClientConfig,
  setInvestDataClientConfig,
} from '../service/dataClientConfig.ts';
import { buildPublicFilerImageUrl } from '../filer.ts';

describe('publicImage', () => {
  beforeEach(() => {
    setInvestDataClientConfig({
      apiUrls: {
        filer: 'https://files.example.com/filer-api',
      },
    });
  });

  afterEach(() => {
    resetInvestDataClientConfig();
  });

  it('replaces backend filer-api placeholders with the configured filer URL and image size', () => {
    expect(buildPublicFilerImageUrl('::filer-api::/v1.0/public/files/946742', 'small')).toBe(
      'https://files.example.com/filer-api/v1.0/public/files/946742?size=small',
    );
  });

  it('does not duplicate the API version when the configured filer URL already includes it', () => {
    setInvestDataClientConfig({
      apiUrls: {
        filer: 'https://files.example.com/filer-api/v1.0',
      },
    });

    expect(buildPublicFilerImageUrl('::filer-api::/v1.0/public/files/946742', 'small')).toBe(
      'https://files.example.com/filer-api/v1.0/public/files/946742?size=small',
    );
  });

  it('adds the requested size to direct public filer file URLs', () => {
    expect(buildPublicFilerImageUrl(
      'https://files.example.com/filer-api/v1.0/public/files/946742',
      'small',
    )).toBe('https://files.example.com/filer-api/v1.0/public/files/946742?size=small');
  });

  it('leaves non-filer image URLs unchanged', () => {
    expect(buildPublicFilerImageUrl('https://assets.example.com/token.png', 'small')).toBe(
      'https://assets.example.com/token.png',
    );
  });
});
