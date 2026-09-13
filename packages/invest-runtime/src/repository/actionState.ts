import { ref, type Ref } from 'vue';
import {
  createErrorActionState,
  createInitialActionState,
  createLoadingActionState,
  createSuccessActionState,
  withOfflineHydrationMeta,
  type ActionState,
} from '@global-torque/invest-data/repository';

export type { ActionState, OptionsStateData } from '@global-torque/invest-data/repository';

export function applyOfflineHydrationMeta<T>(
  stateRef: Ref<ActionState<T | undefined>>,
  headers: Headers,
): void {
  stateRef.value = withOfflineHydrationMeta(stateRef.value, headers);
}

export function mapValidListItems<TInput, TOutput>(
  items: readonly TInput[],
  mapItem: (item: TInput, index: number) => TOutput,
  describeItem: (item: TInput, index: number) => string,
): TOutput[] {
  const mappedItems: TOutput[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      mappedItems.push(mapItem(item, index));
    }
    catch (error) {
      let itemDescription = `list item at index ${index}`;
      try {
        itemDescription = describeItem(item, index);
      }
      catch {
        // Hostile third-party values may be unsafe even to describe.
      }
      console.error(`Skipping invalid ${itemDescription}`, error);
    }
  }

  return mappedItems;
}

type ListFormatterCache<TInput, TOutput> = {
  format: (item: TInput) => TOutput;
  prune: (items: TInput[]) => void;
};

export function formatValidCachedItems<TInput, TOutput>(
  items: readonly TInput[],
  cache: ListFormatterCache<TInput, TOutput>,
  describeItem: (item: TInput, index: number) => string,
): { validItems: TInput[]; formattedItems: TOutput[] } {
  const validItems: TInput[] = [];
  const formattedItems = mapValidListItems(
    items,
    (item) => {
      const formatted = cache.format(item);
      validItems.push(item);
      return formatted;
    },
    describeItem,
  );

  cache.prune(validItems);
  return { validItems, formattedItems };
}

export function createActionState<T>(defaultData?: T): Ref<ActionState<T>> {
  return ref(createInitialActionState(defaultData)) as Ref<ActionState<T>>;
}

export function createRepositoryStates<T extends Record<string, unknown>>(
  config: { [K in keyof T]?: T[K] },
): { [K in keyof T]: Ref<ActionState<T[K]>> } & { resetAll: () => void } {
  const keys = Object.keys(config) as (keyof T)[];
  const stateRefs = keys.reduce(
    (acc, key) => {
      acc[key] = createActionState(config[key]) as Ref<ActionState<T[keyof T]>>;
      return acc;
    },
    {} as { [K in keyof T]: Ref<ActionState<T[K]>> },
  );

  return {
    ...stateRefs,
    resetAll: () => {
      for (const key of keys) {
        stateRefs[key].value = createInitialActionState(undefined) as ActionState<T[keyof T]>;
      }
    },
  };
}

export async function withActionState<T>(
  stateRef: Ref<ActionState<T | undefined>>,
  action: () => Promise<T>,
): Promise<T> {
  stateRef.value = createLoadingActionState<T | undefined>();
  try {
    const result = await action();
    stateRef.value = createSuccessActionState(result);
    return result;
  }
  catch (error) {
    stateRef.value = createErrorActionState<T | undefined>(error as Error);
    throw error;
  }
}
