import { ref, type Ref } from 'vue';
import {
  createErrorActionState,
  createInitialActionState,
  createLoadingActionState,
  createSuccessActionState,
  withOfflineHydrationMeta,
  type ActionState,
  type OptionsStateData,
} from '@global-torque/invest-data/repository';

export type { OptionsStateData };

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
  const formattedItems: TOutput[] = [];
  items.forEach((item, index) => {
    try {
      formattedItems.push(cache.format(item));
      validItems.push(item);
    }
    catch (error) {
      console.error(`Skipping invalid ${describeItem(item, index)}`, error);
    }
  });
  cache.prune(validItems);
  return { validItems, formattedItems };
}

export function applyOfflineHydrationMeta<T>(
  state: Ref<ActionState<T | undefined>>,
  headers: Headers,
): void {
  state.value = withOfflineHydrationMeta(state.value, headers);
}

export const createActionState = <T>(defaultData?: T): Ref<ActionState<T>> => (
  ref(createInitialActionState(defaultData)) as Ref<ActionState<T>>
);

export const createRepositoryStates = <T extends Record<string, unknown>>(
  config: { [K in keyof T]?: T[K] },
): { [K in keyof T]: Ref<ActionState<T[K]>> } & { resetAll: () => void } => {
  const keys = Object.keys(config) as (keyof T)[];
  const stateRefs = keys.reduce((states, key) => {
    states[key] = createActionState(config[key]) as Ref<ActionState<T[keyof T]>>;
    return states;
  }, {} as { [K in keyof T]: Ref<ActionState<T[K]>> });

  const resetAll = () => {
    for (const key of keys) {
      stateRefs[key].value = createInitialActionState(undefined) as ActionState<T[keyof T]>;
    }
  };

  return { ...stateRefs, resetAll };
};

export const withActionState = async <T>(
  state: Ref<ActionState<T | undefined>>,
  action: () => Promise<T>,
): Promise<T> => {
  state.value = createLoadingActionState<T | undefined>();
  try {
    const result = await action();
    state.value = createSuccessActionState(result);
    return result;
  }
  catch (error) {
    state.value = createErrorActionState<T | undefined>(error as Error);
    throw error;
  }
};
