import { JSONSchemaType } from 'ajv/dist/types/json-schema';
import cloneDeep from 'lodash/cloneDeep.js';
import defaults from 'lodash/defaults.js';
import pick from 'lodash/pick.js';
import { capitalizeFirstLetter } from './text';

export function populateModel<T extends object>(source: Partial<T>, defaultsObj: T): T {
  // ensure only keys from defaults are preserved; then fill missing via defaults
  const picked = pick(source as Record<string, any>, Object.keys(defaultsObj)) as Partial<T>;
  return defaults({} as T, picked, defaultsObj);
}

// Function to initialize properties recursively
const initializeProperties = (properties: Record<string, any>): Record<string, any> => {
  // Default type initializers for known types
  const defaultValueMap: Record<string, any> = {
    string: '',
    number: 0,
    object: {},
    boolean: false,
  };
  return Object.keys(properties).reduce((acc, key) => {
    const prop = properties[key];

    // Handle nested objects
    if (prop.type === 'object' && prop.properties) {
      acc[key] = initializeProperties(prop.properties);
    } else {
      // Handle basic types
      acc[key] = defaultValueMap[prop.type] ?? null;
    }

    return acc;
  }, {} as Record<string, any>);
};

export const createFormModel = <T>(schema: JSONSchemaType<T>): Record<string, any> => {
  if (!schema || !schema.$ref) return {} as Record<string, any>;
  // clone deep to ensure we don't mix schemas
  const newSchema = cloneDeep(schema);
  // get path
  const path = newSchema.$ref?.replace('#/', '')?.split('/') || [];

  // get object from path
  let mainDataObject = newSchema;
  for (const key of path) { // TODO reqrite as array iteration
    if (key !== '') mainDataObject = mainDataObject[key];
  }
  // Initialize form model based on the schema's root definition
  const rootDefinition = mainDataObject.properties;
  return initializeProperties(rootDefinition);
};

export const getOptions = (
  fieldPath: string,
  schemaObject: { value: any }, // Pass schemaObject as a prop
): { value: string; name: string }[] => {
  const optionsCache = new Map<string, { value: string; name: string }[]>();
  // Check if options for this field are already cached
  if (optionsCache.has(fieldPath)) {
    return optionsCache.get(fieldPath) || [];
  }

  // Split the fieldPath into parts and traverse the schema object
  const target = fieldPath.split('.').reduce((acc, part) => acc?.[part], schemaObject.value);

  // If the target field doesn't exist, return empty options
  if (!target) {
    optionsCache.set(fieldPath, []);
    return [];
  }

  // Extract the options (enum and enumNames) from the target field
  const values = target?.enum || [];
  const names = target?.enumNames || [];

  // Map the values and names to an array of objects { value, name }
  const options = values.map((value: string, index: number) => ({
    value,
    name: capitalizeFirstLetter(names[index] || value), // Default to the value itself if no enumNames
  }));

  // Cache the options for future use
  optionsCache.set(fieldPath, options);

  return options;
};
