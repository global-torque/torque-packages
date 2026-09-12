/**
 * Resolve a Vue component name from a VM instance (Vue 2 or Vue 3).
 */
export const resolveComponentName = (vm: any, fallback: string = 'Unknown Component'): string => {
  // Vue 3 instance shape
  const v3Name = vm?.type?.name;
  if (v3Name && typeof v3Name === 'string') return v3Name;
  const v3File = vm?.type?.__file;
  if (v3File && typeof v3File === 'string') {
    const fileNameWithExt = v3File.split('/').pop() || v3File;
    const dotIndex = fileNameWithExt.lastIndexOf('.');
    return dotIndex > 0 ? fileNameWithExt.slice(0, dotIndex) : fileNameWithExt;
  }

  // Vue 2 instance shape
  const explicitName = vm?.$options?.name;
  if (explicitName && typeof explicitName === 'string') return explicitName;
  const filePath = vm?.$options?.__file;
  if (filePath && typeof filePath === 'string') {
    const fileNameWithExt = filePath.split('/').pop() || filePath;
    const dotIndex = fileNameWithExt.lastIndexOf('.');
    return dotIndex > 0 ? fileNameWithExt.slice(0, dotIndex) : fileNameWithExt;
  }
  return fallback;
};

