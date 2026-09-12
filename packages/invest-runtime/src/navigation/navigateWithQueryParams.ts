type QueryParamValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;
type QueryParamEntry = [string, QueryParamValue | QueryParamValue[]];
type QueryParamInput = QueryParams | Iterable<QueryParamEntry>;

export function navigateWithQueryParams(url: string, params?: QueryParamInput): void {
  const target = new URL(url, window.location.origin);

  if (params) {
    const entries = typeof (params as Iterable<QueryParamEntry>)[Symbol.iterator] === 'function'
      ? Array.from(params as Iterable<QueryParamEntry>)
      : Object.entries(params);

    entries.forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value
          .filter((item): item is Exclude<QueryParamValue, null | undefined> => item != null)
          .forEach(item => target.searchParams.append(key, String(item)));
      }
      else if (value != null) {
        target.searchParams.set(key, String(value));
      }
    });
  }

  window.location.href = target.toString();
}
