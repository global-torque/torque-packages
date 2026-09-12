import { describe, expect, it } from 'vitest';
import type { JSONSchemaType } from 'ajv/dist/types/json-schema';
import {
  composeInvestmentFormSchema,
  createInvestmentAjv,
  getReferenceType,
  prepareInvestmentFormData,
} from '../index.ts';

describe('investment form policy', () => {
  it('registers investment keywords per validator and keeps neutral validators isolated', () => {
    const schema = { type: 'object', properties: { country: { type: 'string', mustBeUS: true } }, required: ['country'] } as unknown as JSONSchemaType<{ country: string }>;
    const first = createInvestmentAjv();
    const second = createInvestmentAjv();
    expect(first.compile(schema)({ country: 'CA' })).toBe(false);
    expect(second.compile(schema)({ country: 'CA' })).toBe(false);
  });

  it('does not mutate frontend or backend schemas while applying frontend precedence', () => {
    const frontend = { type: 'object', properties: { name: { type: 'string', minLength: 2 } }, required: ['name'] } as unknown as JSONSchemaType<{ name: string }>;
    const backend = { type: 'object', properties: { name: { type: 'string', minLength: 1, contentMediaType: 3 } }, required: ['name'] } as unknown as JSONSchemaType<{ name: string }>;
    const beforeFrontend = JSON.stringify(frontend);
    const beforeBackend = JSON.stringify(backend);
    const composed = composeInvestmentFormSchema(frontend, backend);
    expect((composed as any).properties.name.minLength).toBe(2);
    expect((composed as any).properties.name.contentMediaType).toBeUndefined();
    expect(JSON.stringify(frontend)).toBe(beforeFrontend);
    expect(JSON.stringify(backend)).toBe(beforeBackend);
  });

  it('removes only backend root and named-definition requirements', () => {
    const frontend = {
      type: 'object',
      properties: { name: { type: 'string' } },
    } as unknown as JSONSchemaType<{ name: string }>;
    const backend = {
      type: 'object',
      required: ['legacyRoot'],
      properties: {
        details: {
          type: 'object',
          required: ['inlineField'],
          properties: { inlineField: { type: 'string' } },
        },
      },
      allOf: [{ required: ['composedField'] }],
      definitions: {
        LegacyDetails: {
          type: 'object',
          required: ['definitionField'],
          properties: {
            nested: {
              type: 'object',
              required: ['nestedField'],
              properties: { nestedField: { type: 'string' } },
            },
          },
        },
      },
      $defs: {
        ModernDetails: {
          type: 'object',
          required: ['modernDefinitionField'],
          anyOf: [{ required: ['composedDefinitionField'] }],
        },
      },
    } as unknown as JSONSchemaType<{ name: string }>;
    const beforeBackend = JSON.stringify(backend);

    const composed = composeInvestmentFormSchema(frontend, backend) as any;

    expect(composed.required).toBeUndefined();
    expect(composed.definitions.LegacyDetails.required).toBeUndefined();
    expect(composed.$defs.ModernDetails.required).toBeUndefined();
    expect(composed.properties.details.required).toEqual(['inlineField']);
    expect(composed.allOf[0].required).toEqual(['composedField']);
    expect(composed.definitions.LegacyDetails.properties.nested.required).toEqual(['nestedField']);
    expect(composed.$defs.ModernDetails.anyOf[0].required).toEqual(['composedDefinitionField']);
    expect(JSON.stringify(backend)).toBe(beforeBackend);

    const ajv = createInvestmentAjv();
    const validate = ajv.compile(composed);
    expect(validate({ name: 'Ada' })).toBe(false);
    expect(validate.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        keyword: 'required',
        params: { missingProperty: 'composedField' },
      }),
    ]));
    expect(validate({ name: 'Ada', composedField: true } as any)).toBe(true);
  });

  it('normalizes nested empty strings on a cloned model and preserves policy reference fallback', () => {
    const model = { identity: { firstName: '', lastName: 'A' }, values: ['', 'x'] };
    expect(prepareInvestmentFormData(model)).toEqual({ identity: { firstName: undefined, lastName: 'A' }, values: [undefined, 'x'] });
    expect(model.identity.firstName).toBe('');
    expect(getReferenceType({ $ref: '#/$defs/Entity' })).toBe('Entity');
    expect(getReferenceType({ $ref: '#/$defs/Unknown' })).toBe('Individual');
  });
});
