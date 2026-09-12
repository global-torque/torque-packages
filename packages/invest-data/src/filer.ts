import type {
  FilerAccess,
  FilerId,
  FilerNotificationFields,
  FilerObjectTree,
  FilerUploadResult,
  IFilerItem,
  IPostSignurlResponse,
} from '@webdevelop-pro/domain-types/filerTypes';
import { createInvestDataApiClient, getInvestDataApiUrl } from './service/dataClientConfig.ts';
import {
  buildPublicFilerImageSource as buildCorePublicFilerImageSource,
  buildPublicFilerImageSrcset as buildCorePublicFilerImageSrcset,
  buildPublicFilerImageUrl as buildCorePublicFilerImageUrl,
  type BuildPublicFilerImageSrcsetOptions,
  type PublicFilerImageSize,
} from '@webdevelop-pro/invest-core/filer/publicImage';

export {
  DEFAULT_PUBLIC_FILER_IMAGE_DIMENSIONS,
  PUBLIC_FILER_IMAGE_SIZE_ORDER,
  PUBLIC_FILER_IMAGE_WIDTH_DIVISOR,
  getPublicFilerWidthDescriptor,
  type BuildPublicFilerImageSrcsetOptions,
  type BuildPublicFilerImageUrlOptions,
  type PublicFilerImageSize,
} from '@webdevelop-pro/invest-core/filer/publicImage';

const UPLOAD_TIMEOUT_MS = 120_000;
const FILER_API_PLACEHOLDER = '::filer-api::';
const FILER_PUBLIC_FILE_PATH_REGEXP = /\/public\/files\/\d+(?:$|[?#])/;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getFilerApiUrl = () => {
  const filerUrl = getInvestDataApiUrl('filer');
  return filerUrl ? trimTrailingSlash(filerUrl).replace(/\/v1\.0$/, '') : undefined;
};

const withPublicFilerImageSize = (url: string, size: PublicFilerImageSize) => {
  const [withoutHash, hash] = url.split('#');
  const [path, query] = withoutHash.split('?');
  const params = new URLSearchParams(query ?? '');
  params.set('size', size);
  return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
};

const normalizePublicFilerImageUrl = (
  value?: number | string | null,
  size: PublicFilerImageSize = 'medium',
) => {
  if (typeof value !== 'string') return undefined;
  const trimmedValue = value.trim();
  const filerApiUrl = getFilerApiUrl();
  const normalizedUrl = filerApiUrl && trimmedValue.startsWith(FILER_API_PLACEHOLDER)
    ? trimmedValue.replace(FILER_API_PLACEHOLDER, filerApiUrl)
    : trimmedValue;
  if (!FILER_PUBLIC_FILE_PATH_REGEXP.test(normalizedUrl)) return undefined;
  return withPublicFilerImageSize(normalizedUrl, size);
};

export const buildPublicFilerImageUrl = (
  fileId?: number | string | null,
  size: PublicFilerImageSize = 'medium',
) => normalizePublicFilerImageUrl(fileId, size)
  ?? buildCorePublicFilerImageUrl(fileId, size, { filerUrl: getInvestDataApiUrl('filer') });

export const buildPublicFilerImageSrcset = (
  fileId?: number | string | null,
  options: BuildPublicFilerImageSrcsetOptions = {},
) => buildCorePublicFilerImageSrcset(fileId, {
  ...options,
  filerUrl: getInvestDataApiUrl('filer'),
});

export const buildPublicFilerImageSource = (
  fileId?: number | string | null,
  options: BuildPublicFilerImageSrcsetOptions = {},
) => buildCorePublicFilerImageSource(fileId, {
  ...options,
  filerUrl: getInvestDataApiUrl('filer'),
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const parseId = (value: unknown): FilerId | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
};

const parseNode = (value: unknown): IFilerItem | null => {
  if (!isRecord(value)) return null;

  const entitiesValue = isRecord(value.entities) ? value.entities : undefined;
  const entities = entitiesValue
    ? Object.fromEntries(
        Object.entries(entitiesValue)
          .map(([key, child]) => [key, parseNode(child)] as const)
          .filter((entry): entry is readonly [string, IFilerItem] => entry[1] !== null),
      )
    : undefined;

  const node: IFilerItem = { ...value, id: undefined, entities: undefined };
  const id = parseId(value.id);
  if (id !== undefined) node.id = id;
  if (entities) node.entities = entities;
  return node;
};

/** Parse the recursive i-filer envelope without assuming a fixed folder depth. */
export const parseFilerObjectTree = (value: unknown): FilerObjectTree => {
  const candidates = Array.isArray(value) ? value : [value];
  const entities: Record<string, IFilerItem> = {};

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const source = isRecord(candidate.entities) ? candidate.entities : candidate;
    for (const [key, rawNode] of Object.entries(source)) {
      const node = parseNode(rawNode);
      if (node) entities[key] = node;
    }
  }

  return { entities };
};

const requireFilerBaseUrl = (): string => {
  const value = getInvestDataApiUrl('filer')?.trim();
  if (!value) throw new Error('Filer base URL is not configured');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Filer base URL is invalid');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Filer base URL must use HTTP or HTTPS');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Filer base URL must not contain credentials, a query, or a fragment');
  }
  return parsed.toString().replace(/\/+$/, '');
};

const buildObjectPath = (objectName: string, objectId: FilerId) => {
  const encodePath = (value: string, label: string) => {
    const segments = value.split('/').filter(Boolean);
    if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) {
      throw new Error(`Filer ${label} is required`);
    }
    return segments.map(encodeURIComponent).join('/');
  };
  const normalizedName = encodePath(objectName, 'object name');
  if (!normalizedName) throw new Error('Filer object name is required');
  const normalizedId = String(objectId).trim();
  if (!normalizedId) throw new Error('Filer object id is required');
  return `${normalizedName}/${encodePath(normalizedId, 'object id')}`;
};

export interface FetchObjectTreeOptions {
  access: FilerAccess;
  objectId: FilerId;
  objectName: string;
  signal?: AbortSignal;
}

export async function fetchObjectTree(options: FetchObjectTreeOptions): Promise<FilerObjectTree> {
  const filerBaseUrl = requireFilerBaseUrl();
  const apiClient = createInvestDataApiClient('filer', { apiUrls: { filer: filerBaseUrl } });
  const prefix = options.access === 'public' ? '/public/objects' : '/auth/objects';
  const response = await apiClient.get<unknown>(
    `${prefix}/${buildObjectPath(options.objectName, options.objectId)}`,
    { signal: options.signal },
  );
  return parseFilerObjectTree(response.data);
}

const parseSignResponse = (value: unknown) => {
  if (!isRecord(value)) throw new Error('Filer returned a malformed upload response');
  const meta = isRecord(value.meta) ? value.meta : {};
  const rawFileId = value.file_id ?? meta.id;
  const fileId = Number(rawFileId);
  if (!Number.isSafeInteger(fileId) || fileId <= 0) {
    throw new Error('Filer upload response is missing a valid file id');
  }

  const rawUrl = typeof value.url === 'string' ? value.url.trim() : '';
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Filer upload response is missing a valid sign URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Filer upload sign URL must use HTTP or HTTPS');
  }

  return {
    fileId,
    url: url.toString(),
  };
};

export interface UploadFilerFileOptions {
  objectId: FilerId;
  objectName: string;
  userId: number;
  signal?: AbortSignal;
}

const uploadObject = (
  file: File,
  uploadUrl: string,
  fileId: number,
  signal?: AbortSignal,
) => new Promise<void>((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  const abort = () => xhr.abort();
  const cleanup = () => signal?.removeEventListener('abort', abort);
  const fail = (message: string, name = 'Error') => {
    cleanup();
    const error = new Error(message);
    error.name = name;
    reject(error);
  };

  if (signal?.aborted) {
    fail('Upload aborted', 'AbortError');
    return;
  }

  xhr.open('PUT', uploadUrl, true);
  xhr.timeout = UPLOAD_TIMEOUT_MS;
  xhr.setRequestHeader('Content-Type', file.type);
  xhr.setRequestHeader('x-goog-meta-file-id', String(fileId));
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      cleanup();
      resolve();
    }
    else fail(`Object upload failed with status ${xhr.status}`);
  };
  xhr.onerror = () => fail('Object upload failed');
  xhr.ontimeout = () => fail('Object upload timed out');
  xhr.onabort = () => fail('Upload aborted', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  try {
    xhr.send(file);
  }
  catch (error) {
    fail(error instanceof Error ? error.message : 'Object upload failed');
  }
});

export async function uploadFilerFile(
  file: File,
  options: UploadFilerFileOptions,
): Promise<FilerUploadResult> {
  const filerBaseUrl = requireFilerBaseUrl();
  const apiClient = createInvestDataApiClient('filer', { apiUrls: { filer: filerBaseUrl } });
  const signResponse = await apiClient.post<IPostSignurlResponse>('/auth/files/signurl', {
    filename: file.name,
    mime: file.type,
    user_id: options.userId,
    path: `/${buildObjectPath(options.objectName, options.objectId)}`,
  }, { signal: options.signal });
  const sign = parseSignResponse(signResponse.data);

  await uploadObject(file, sign.url, sign.fileId, options.signal);

  return { fileId: sign.fileId };
}

export const parseFilerNotificationFields = (value: unknown): FilerNotificationFields | null => {
  if (!isRecord(value)) return null;
  const data = isRecord(value.data) ? value.data : value;
  const rawFields = data.fields ?? data;

  if (Array.isArray(rawFields)) {
    const merged = rawFields.filter(isRecord).reduce<Record<string, unknown>>(
      (result, item) => ({ ...result, ...item }),
      {},
    );
    return Object.keys(merged).length ? merged as FilerNotificationFields : null;
  }

  if (!isRecord(rawFields)) return null;
  const looksLikeFieldMap = Object.values(rawFields).every(isRecord)
    && !('type' in rawFields)
    && !('object_id' in rawFields)
    && !('source_file_id' in rawFields);
  if (looksLikeFieldMap) {
    const first = Object.values(rawFields).find(isRecord);
    return first ? first as FilerNotificationFields : null;
  }
  return rawFields as FilerNotificationFields;
};
