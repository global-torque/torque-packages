import { describe, expect, it } from 'vitest';
import type { FilerObjectTree } from '@global-torque/domain-types/filerTypes';
import { FilerFormatter } from '../documentFormatter.ts';

describe('FilerFormatter', () => {
  it('recursively flattens root/deep documents, excludes media, and uses Other for root files', () => {
    const tree: FilerObjectTree = {
      entities: {
        root: { id: 1, filename: 'root.pdf', mime: 'application/pdf', created_at: 'invalid' },
        agreements: {
          name: 'investment_agreements',
          entities: {
            nested: { name: 'Nested', entities: {
              deep: { id: '2', filename: 'deep.pdf', mime: 'application/pdf', created_at: '2026-01-02T00:00:00Z' },
            } },
            media: { name: 'media', entities: {
              nestedImage: { id: 4, filename: 'nested-image.png', mime: 'image/png' },
            } },
          },
        },
        media: { name: 'media', entities: {
          image: { id: 3, filename: 'image.png', mime: 'image/png' },
        } },
      },
    };
    const rows = FilerFormatter.getFormattedInvestmentDocuments(
      [{ access: 'private', tree }],
      'https://files.example.test',
    );
    expect(rows.map((row) => row.name)).toEqual(['deep.pdf', 'root.pdf']);
    expect(rows.find((row) => row.id === 1)).toMatchObject({
      category: 'other',
      date: '—',
      dateTimestamp: null,
    });
    expect(rows.every((row) => row.url === undefined)).toBe(true);
  });

  it('uses created_at before updated_at, keeps invalid dates last, and prefers public duplicate ids', () => {
    const privateTree: FilerObjectTree = { entities: {
      one: { id: 1, filename: 'private.pdf', mime: 'application/pdf', created_at: '2026-02-01T00:00:00Z' },
      two: { id: 2, filename: 'older.pdf', mime: 'application/pdf', created_at: '2025-01-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z' },
      three: { id: 3, filename: 'invalid.pdf', mime: 'application/pdf', created_at: 'invalid' },
    } };
    const publicTree: FilerObjectTree = { entities: {
      one: { id: 1, filename: 'public.pdf', mime: 'application/pdf', created_at: '2026-02-01T00:00:00Z' },
    } };
    const rows = FilerFormatter.getFormattedInvestmentDocuments([
      { access: 'private', tree: privateTree },
      { access: 'public', tree: publicTree },
    ], 'https://files.example.test');

    expect(rows.map((row) => row.name)).toEqual(['public.pdf', 'older.pdf', 'invalid.pdf']);
    expect(rows[0]).toMatchObject({ access: 'public', key: 'public:1' });
    expect(rows[1].dateTimestamp).toBe(Date.parse('2025-01-01T00:00:00Z'));
    expect(rows[2].dateTimestamp).toBeNull();
  });

  it('keeps identical filenames with different ids', () => {
    const tree: FilerObjectTree = { entities: {
      one: { id: 1, filename: 'same.pdf', mime: 'application/pdf' },
      two: { id: 2, filename: 'same.pdf', mime: 'application/pdf' },
    } };
    expect(FilerFormatter.getFormattedInvestmentDocuments(
      [{ access: 'private', tree }],
      'https://files.example.test',
    )).toHaveLength(2);
  });

  it('keeps minimal leaf nodes, prefers filename over metadata name, and does not mask invalid creation dates', () => {
    const tree: FilerObjectTree = { entities: {
      minimal: { id: 10, name: 'Minimal document' },
      named: {
        id: 11,
        name: 'Metadata label',
        filename: 'actual-file.pdf',
        created_at: 'invalid',
        updated_at: '2026-07-22T00:00:00Z',
      },
    } };

    const rows = FilerFormatter.getFormattedInvestmentDocuments(
      [{ access: 'private', tree }],
      'https://files.example.test',
    );

    expect(rows.map(row => row.name)).toEqual(['Minimal document', 'actual-file.pdf']);
    expect(rows.find(row => row.id === 11)).toMatchObject({
      date: '—',
      dateTimestamp: null,
    });
  });

  it('keeps empty folders out of document rows and exposes them as folder tabs', () => {
    const tree: FilerObjectTree = { entities: {
      tax: {
        id: 20,
        type: 'folder',
        name: 'Tax documents',
        created_at: '2026-08-13T00:00:00Z',
      },
      agreements: {
        id: 21,
        type: 'folder',
        name: 'investment_agreements',
        entities: {
          agreement: {
            id: 22,
            type: 'file',
            filename: 'agreement.pdf',
            mime: 'application/pdf',
          },
        },
      },
      rootDocument: {
        id: 23,
        type: 'file',
        filename: 'root.pdf',
        mime: 'application/pdf',
      },
    } };
    const sources = [{ access: 'private' as const, tree }];

    const rows = FilerFormatter.getFormattedInvestmentDocuments(
      sources,
      'https://files.example.test',
    );

    expect(rows.map(row => row.name)).toEqual(['agreement.pdf', 'root.pdf']);
    expect(rows.some(row => row.id === 20)).toBe(false);
    expect(FilerFormatter.getFolderedInvestmentDocuments(sources)).toEqual([
      'Tax documents',
      'Investment Agreements',
      'Other',
    ]);
  });

  it('keeps an original document but excludes its generated thumbnail descendants', () => {
    const tree: FilerObjectTree = { entities: {
      other: {
        name: 'other',
        entities: {
          '95430aa4bf08da89aad368bc91f70bc1272a90c0': {
            id: 698167,
            filename: '95430aa4bf08da89aad368bc91f70bc1272a90c0',
            original_filename: 'Gemini_Generated_Image.png',
            mime: 'image/png',
            type: 'file',
            entities: {
              big: {
                name: 'big',
                entities: {
                  thumbnail: {
                    id: 698172,
                    original_filename: 'Gemini_Generated_Image.png',
                    mime: 'image/avif',
                    type: 'file_thumbnail',
                    meta_data: { size: 'big' },
                  },
                },
              },
              medium: {
                name: 'medium',
                entities: {
                  thumbnail: {
                    id: 698170,
                    original_filename: 'Gemini_Generated_Image.png',
                    mime: 'image/avif',
                    type: 'file_thumbnail',
                    meta_data: { size: 'medium' },
                  },
                },
              },
              small: {
                name: 'small',
                entities: {
                  thumbnail: {
                    id: 698168,
                    original_filename: 'Gemini_Generated_Image.png',
                    mime: 'image/avif',
                    type: 'file_thumbnail',
                    meta_data: { size: 'small' },
                  },
                },
              },
            },
          },
        },
      },
    } };

    const rows = FilerFormatter.getFormattedInvestmentDocuments(
      [{ access: 'public', tree }],
      'https://files.example.test',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 698167,
      name: 'Gemini_Generated_Image.png',
      category: 'other',
      typeFormatted: 'Other',
    });
    expect(FilerFormatter.getFolderedInvestmentDocuments([
      { access: 'public', tree },
    ])).toEqual(['Other']);
  });
});
