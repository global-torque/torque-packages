import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { filterSchema } from '../general.ts';

describe('filterSchema', () => {
  it('projects fields without removing inline requirements or mutating the source schema', () => {
    const schema = {
      type: 'object',
      required: ['legacyRoot'],
      properties: {
        inline: {
          type: 'object',
          required: ['inlineField'],
          properties: { inlineField: { type: 'string' } },
        },
        referenced: { $ref: '#/$defs/Named' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['itemField'],
            properties: { itemField: { type: 'string' } },
          },
        },
        choice: { type: 'string', enum: ['selected'] },
        omitted: { type: 'string' },
      },
      allOf: [{
        required: ['choice'],
        properties: { choice: { type: 'string' } },
      }],
      $defs: {
        Named: {
          type: 'object',
          required: ['namedRoot'],
          properties: {
            nested: {
              type: 'object',
              required: ['namedNested'],
              properties: { namedNested: { type: 'string' } },
            },
          },
        },
      },
    };
    const before = JSON.stringify(schema);

    const filtered = filterSchema(schema as any, {
      inline: {},
      referenced: {},
      items: [],
      choice: 'selected',
    }) as any;

    expect(JSON.stringify(schema)).toBe(before);
    expect(filtered.required).toBeUndefined();
    expect(filtered.properties.omitted).toBeUndefined();
    expect(filtered.properties.choice.enum).toBeUndefined();
    expect(filtered.properties.inline.required).toEqual(['inlineField']);
    expect(filtered.properties.items.items.required).toEqual(['itemField']);
    expect(filtered.allOf[0].required).toEqual(['choice']);
    expect(filtered.$defs.Named.required).toBeUndefined();
    expect(filtered.$defs.Named.properties.nested.required).toEqual(['namedNested']);

    const validate = new Ajv({ allErrors: true, strict: false }).compile(filtered);
    expect(validate({
      inline: {},
      referenced: { nested: {} },
      items: [{}],
      choice: 'selected',
    })).toBe(false);
    expect(validate.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ instancePath: '/inline', keyword: 'required' }),
      expect.objectContaining({ instancePath: '/referenced/nested', keyword: 'required' }),
      expect.objectContaining({ instancePath: '/items/0', keyword: 'required' }),
    ]));
  });
});
