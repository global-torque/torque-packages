import { capitalizeFirstLetter } from './text';

export function combineArraysToObjects(names: string[], values: string[]): { name: string; value: string }[] {
  // Ensure both arrays have the same length to avoid mismatches
  const length = Math.min(names.length, values.length);

  return names.slice(0, length).map((name, index) => ({
    name: capitalizeFirstLetter(name),
    value: values[index],
  }));
}
