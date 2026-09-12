import type { JSONSchemaType } from 'ajv/dist/types/json-schema';
import cloneDeep from 'lodash/cloneDeep.js';
import merge from 'lodash/merge.js';
import { undefinedEmptyProp } from './general.ts';

export type InvestmentSchema<T extends object = object> = JSONSchemaType<T> & Record<string, unknown>;

function removeRequiredFromDefinitions(schema: any) {
  // The backend projection is allowed to omit only schema-level requirements
  // and requirements declared by named definitions. Inline field, item, and
  // composition requirements remain validation policy and must survive.
  const visitDefinitions = (node: any, includeRoot: boolean) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    if (includeRoot) delete node.required;
    for (const key of ['definitions', '$defs']) {
      const definitions = node[key];
      if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) continue;
      for (const definition of Object.values(definitions)) {
        visitDefinitions(definition, true);
      }
    }
  };
  visitDefinitions(schema, true);
  return schema;
}

function sanitizeContentMediaType(schema: any) {
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if ('contentMediaType' in node && typeof node.contentMediaType !== 'string') delete node.contentMediaType;
    Object.values(node).forEach(value => {
      if (value && typeof value === 'object') visit(value);
    });
  };
  visit(schema);
  return schema;
}

/**
 * Compose app-owned frontend rules with backend schema metadata without
 * mutating either input. Frontend fields take precedence while backend
 * definitions retain compatibility with the legacy form projection.
 */
export function composeInvestmentFormSchema<T extends object>(
  frontend: Readonly<JSONSchemaType<T>>,
  backend: Readonly<JSONSchemaType<T>> | undefined,
): JSONSchemaType<T> {
  const frontendClone = cloneDeep(frontend);
  if (!backend) return frontendClone;
  const backendClone = sanitizeContentMediaType(removeRequiredFromDefinitions(cloneDeep(backend)));
  return merge({}, backendClone, frontendClone) as JSONSchemaType<T>;
}

/** Preserve the old investment form empty-string normalization on a clone. */
export function prepareInvestmentFormData<T extends object>(model: Readonly<T>): T {
  return undefinedEmptyProp(model as T);
}

const REFERENCE_TYPES = new Set(['Individual', 'Entity', 'Trust', 'Sdira', 'Solo401k', 'SdiraEdit']);

export function getReferenceType(schema?: { $ref?: string }): string {
  const refType = schema?.$ref?.split('/').pop();
  return refType && REFERENCE_TYPES.has(refType) ? refType : 'Individual';
}
