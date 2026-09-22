import lodashIsEmpty from 'lodash-es/isEmpty.js';
import startCase from 'lodash-es/startCase.js';
import toLower from 'lodash-es/toLower.js';
import unionBy from 'lodash-es/unionBy.js';
import kebabCase from 'lodash-es/kebabCase.js';

export function isEmpty(obj: object) {
  return lodashIsEmpty(obj);
}

export function formatPhoneNumber(phoneNumber: string | undefined): string | undefined {
  if (!phoneNumber) return undefined;
  // Remove all non-digit characters from the input string
  let cleaned: string = phoneNumber.replace(/\D/g, '');
  // Extract the country code (if present)
  let countryCode: string = '';
  if (cleaned.length > 10) {
    countryCode = `+${cleaned.slice(0, cleaned.length - 10)} `;
    // Remove country code from the cleaned string
    cleaned = cleaned.slice(-10);
  }
  // Extract the area code and the rest of the number
  const areaCode: string = cleaned.slice(0, 3);
  const middlePart: string = cleaned.slice(3, 6);
  const lastPart: string = cleaned.slice(6);

  // Format the phone number parts into the desired format
  const formattedPhoneNumber: string = `${countryCode}(${areaCode}) ${middlePart}-${lastPart}`;

  return formattedPhoneNumber;
}

export function booleanFormatToString(value: boolean | undefined) {
  if (value === undefined) return undefined;
  if (value) return 'Yes';
  return 'No';
}

export function checkObjectAndDeleteNotRequiredFields(
  defaultParameters: string[],
  requiredFields: string[],
  obj: Record<string, string>,
) {
  return Object.keys(obj).reduce<Record<string, string>>((acc, key) => {
    if (defaultParameters.includes(key)) {
      acc[key] = obj[key]; // Set the new value for 'type'
    } else if (requiredFields.includes(obj[key])) {
      acc[key] = obj[key];
    } else {
      // If property value is not in requiredEmployment.value, delete the property
      delete acc[key];
    }
    return acc;
  }, {});
}

export function urlize(input: string): string {
  return kebabCase(input);
}

export function getUniqueCapitalizedTags(
  items: readonly { tags?: readonly string[] | null }[],
): string[] {
  if (!items || items.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  items.forEach((item) => {
    const tags = (item.tags || []).filter(Boolean) as string[];
    tags.forEach((rawTag) => {
      const trimmed = rawTag.trim();
      if (!trimmed) return;
      const key = toLower(trimmed);
      if (seen.has(key)) return;
      seen.add(key);
      // Preserve common separators like '/' while capitalizing parts
      if (key.includes('/')) {
        const formatted = key.split('/').map((part) => startCase(part)).join('/');
        result.push(formatted);
      } else {
        result.push(startCase(key));
      }
    });
  });

  return result;
}

export function combineTags(
  tagsArray1: readonly string[],
  tagsArray2: readonly string[],
): string[] {
  return unionBy(tagsArray1, tagsArray2, (t) => toLower(t));
}

export function filterItemsByTag<T extends { tags?: readonly string[] }>(
  items: readonly T[],
  activeTag: string,
): T[] {
  if (activeTag !== '') {
    const normalize = (s: string) => kebabCase(toLower(s.trim()));
    const active = normalize(activeTag);
    return items.filter((item) => (item.tags || [])
      .some((tag) => normalize(tag) === active));
  }
  return [...items];
}
// Define interfaces for the expected object structure
interface EntityValue {
  [key: string]: any;
}

interface TopLevelValue {
  entities: Record<string, EntityValue>;
}

interface MergedObject {
  [key: string]: TopLevelValue;
}

export function mergeObjects(obj1: any, obj2: any): MergedObject {
  if (!obj1 || !obj2) return {};
  const merged = { ...obj1 };

  Object.entries(obj2).forEach(([topKey, topValue]) => {
    // Ensure topValue is an object with entities property
    if (topValue && typeof topValue === 'object' && 'entities' in topValue) {
      merged[topKey] = merged[topKey] || { entities: {} };
      merged[topKey].entities = merged[topKey].entities || {};

      // Ensure topValue.entities is an object before iterating
      if (typeof topValue.entities === 'object' && topValue.entities !== null) {
        Object.entries(topValue.entities).forEach(([entityKey, entityValue]) => {
          // Ensure entityValue is an object before spreading
          if (entityValue && typeof entityValue === 'object') {
            merged[topKey].entities[entityKey] = {
              ...merged[topKey].entities[entityKey],
              ...entityValue,
            };
          } else {
            // If entityValue is not an object, just assign it directly
            merged[topKey].entities[entityKey] = entityValue;
          }
        });
      }
    }
  });

  return merged;
}

export const transformedArray = (mergedObj: MergedObject) => {
  if (!mergedObj || Object.keys(mergedObj).length === 0) return [];
  return (Object.keys(mergedObj)?.map((topKey) => {
    if (!mergedObj[topKey]?.entities) return [];
    return (
      Object.keys(mergedObj[topKey]?.entities).map((entityKey) => ({
        name: mergedObj[topKey].entities[entityKey].original_filename || mergedObj[topKey].entities[entityKey].filename,
        'object-type': topKey, // This will be the top-level key, e.g., companyA
        updated_at: mergedObj[topKey].entities[entityKey].updated_at,
        url: mergedObj[topKey].entities[entityKey].url,
      })));
  }).flat());
};
