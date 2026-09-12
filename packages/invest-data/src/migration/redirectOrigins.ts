export const resolveAllowedRedirectOrigins = (
  values: readonly (string | undefined)[],
): string[] => [...new Set(values.flatMap((value) => {
  if (!value?.trim()) return [];
  try {
    return [new URL(value).origin];
  }
  catch {
    return [];
  }
}))];
