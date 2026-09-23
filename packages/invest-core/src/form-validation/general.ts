import type { JSONSchemaType } from 'ajv/dist/types/json-schema';
import cloneDeep from 'lodash-es/cloneDeep.js';
import get from 'lodash-es/get.js';
import pick from 'lodash-es/pick.js';
import set from 'lodash-es/set.js';

interface FilteredObjectElement {
  $ref?: string;
  enum?: Array<any>;
  enumNames?: Array<string>;
  items?: FilteredObjectElement;
  minLength?: number;
  mustBeUS?: boolean;
  properties?: FilteredObject;
  title?: string;
  type?: string;
}
type FilteredObject = Record<string, FilteredObjectElement>;

function cleanEnums(filteredObject: FilteredObject): FilteredObject {
  Object.keys(filteredObject).forEach((key) => {
    const element = filteredObject[key];
    if (element.type === 'string' && element.enum) delete element.enum;
  });
  return filteredObject;
}

export function resolveRef(ref: string, schema: JSONSchemaType<any>) {
  const refPath = ref.replace(/^#\//, '').split('/').map(segment => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
  return ref === '#' ? schema : get(schema, refPath);
}

export const getFilteredObject = (
  schema: JSONSchemaType<any> | undefined,
  formModel: Record<string, any>,
  refPath: string = schema?.$ref || '',
): FilteredObject => {
  if (!schema || !formModel) return {};
  const clonedSchema = cloneDeep(schema);
  const resolvedObject = refPath ? resolveRef(refPath, clonedSchema) : clonedSchema;
  if (!resolvedObject || !Object.keys(resolvedObject).length) return {};
  delete resolvedObject.required;
  set(clonedSchema, [], resolvedObject);
  if (!Object.keys(formModel).length) return resolvedObject.properties;
  return Object.entries(resolvedObject.properties ?? {}).reduce((filteredObject, [key, value]) => {
    const schemaValue = value as FilteredObjectElement;
    if (key in formModel) {
      if (schemaValue.$ref) filteredObject[key] = getFilteredObject(schema, formModel[key], schemaValue.$ref) as FilteredObjectElement;
      else if (schemaValue.type === 'array' && schemaValue.items?.$ref) filteredObject[key] = getFilteredObject(schema, formModel[key], schemaValue.items.$ref) as FilteredObjectElement;
      else filteredObject[key] = schemaValue;
    }
    return filteredObject;
  }, {} as FilteredObject);
};

export function getFieldSchema(path: string | undefined, ref: string | undefined, schema: JSONSchemaType<any>): any | undefined {
  if (!path || !ref) return undefined;
  const objectFromRefPath = resolveRef(ref, schema);
  const pathSegments = path.split('.').filter(segment => Number.isNaN(Number(segment)));
  const firstChild = pathSegments.shift();
  const restSegments = pathSegments.join('.');
  if (!firstChild || !objectFromRefPath?.properties) return undefined;
  const segment0Property = objectFromRefPath.properties[firstChild];
  if (segment0Property?.$ref) return getFieldSchema(restSegments, segment0Property.$ref, schema);
  if (segment0Property?.type === 'array' && segment0Property.items?.$ref) return getFieldSchema(restSegments, segment0Property.items.$ref, schema);
  return objectFromRefPath;
}

function removeRequiredFromDefinitions(schema: any) {
  const visitSchemaRootAndDefinitions = (node: any, removeRootRequired: boolean) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;

    if (removeRootRequired) delete node.required;

    for (const key of ['definitions', '$defs']) {
      const definitions = node[key];
      if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) continue;

      for (const definition of Object.values(definitions)) {
        visitSchemaRootAndDefinitions(definition, true);
      }
    }
  };

  // Backend projection may omit requirements at the schema root and at the
  // roots of named definitions. Requirements on inline properties, items, and
  // composition branches remain validation policy and must survive.
  visitSchemaRootAndDefinitions(schema, true);
  return schema;
}

export const filterSchema = (schema: JSONSchemaType<any>, formModel: any): any => {
  if (!schema) return schema;
  const newSchema = cloneDeep(schema);
  const path = newSchema.$ref?.replace('#/', '')?.split('/') || [];
  const mainDataObject: any = path.length ? get(newSchema, path.join('.')) : newSchema;
  if (!mainDataObject?.properties) return newSchema;
  delete mainDataObject.required;
  set(newSchema, path, mainDataObject);
  removeRequiredFromDefinitions(newSchema);
  const keys = Object.keys(formModel || {});
  set(newSchema, [...path, 'properties'], cleanEnums((keys.length ? pick(mainDataObject.properties, keys) : {}) as FilteredObject));
  return newSchema;
};

export const undefinedEmptyProp = <T extends object>(data: T): T => {
  const clone = cloneDeep(data) as any;
  const visit = (value: any): any => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value === '' ? undefined : value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
  };
  return visit(clone) as T;
};
