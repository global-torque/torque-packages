type FormatterCacheEntry<TOutput> = {
  signature: string;
  formatted: TOutput;
};

type FormatterCacheConfig<TInput, TOutput, TKey extends string | number> = {
  getKey: (item: TInput) => TKey;
  getSignature: (item: TInput) => string;
  format: (item: TInput) => TOutput;
};

export const createFormatterCache = <
  TInput,
  TOutput,
  TKey extends string | number = number,
>(
  config: FormatterCacheConfig<TInput, TOutput, TKey>,
) => {
  const cache = new Map<TKey, FormatterCacheEntry<TOutput>>();

  const format = (item: TInput): TOutput => {
    const key = config.getKey(item);
    const signature = config.getSignature(item);
    const cached = cache.get(key);

    if (cached && cached.signature === signature) {
      return cached.formatted;
    }

    const formatted = config.format(item);
    cache.set(key, { signature, formatted });
    return formatted;
  };

  const formatMany = (items: TInput[]): TOutput[] => items.map(format);

  const prune = (items: TInput[]) => {
    const keys = new Set(items.map(config.getKey));
    for (const key of cache.keys()) {
      if (!keys.has(key)) {
        cache.delete(key);
      }
    }
  };

  const clear = () => {
    cache.clear();
  };

  return {
    format,
    formatMany,
    prune,
    clear,
  };
};
