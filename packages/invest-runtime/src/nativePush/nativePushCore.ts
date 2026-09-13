import type { INotification } from '@global-torque/domain-types/notificationsTypes';

export const NATIVE_PUSH_EXPLAINER_STATE_KEY = 'invest-pro:native-push:explainer-decision';
export const NATIVE_PUSH_PERMISSION_STATE_KEY = 'invest-pro:native-push:permission-decision';
export const NATIVE_PUSH_TOKEN_SYNC_STATE_KEY = 'invest-pro:native-push:token-sync-v1';
export const NATIVE_PUSH_CURRENT_TOKEN_STATE_KEY = 'invest-pro:native-push:current-token-v1';
export const NATIVE_PUSH_TOKEN_REFRESH_STATE_KEY = 'invest-pro:native-push:token-refresh-v1';
export const NATIVE_PUSH_NOTIFICATIONS_FALLBACK_PATH = '/dashboard/notifications';
export const NATIVE_PUSH_DEFAULT_CHANNEL_ID = 'invest-pro-default';
export const NATIVE_PUSH_PROVIDER = 'fcm';

export type NativePushPlatform = 'android' | 'ios';
export type NativePushExplainerDecision = 'accepted' | 'rejected' | 'deferred';
export type NativePushPermissionDecision = 'granted' | 'denied';
export type NativePushFlowAction = 'noop' | 'show-explainer' | 'request-permission' | 'register';

export type NativePushPayloadParseResult =
  | { ok: true; notification: INotification }
  | { ok: false; reason: string };

export interface NativePushRuntimeInfo {
  isNativePlatform: boolean;
  platform: string;
  isPushPluginAvailable?: boolean;
  isMessagingPluginAvailable?: boolean;
}

export interface NativePushFlowState {
  isEligible: boolean;
  isAuthenticated: boolean;
  explainerDecision?: NativePushExplainerDecision | null;
  permissionDecision?: NativePushPermissionDecision | null;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type NativePushTokenSyncState = {
  syncedAtByKey: Record<string, string>;
};

type NativePushTokenState = {
  userId: string;
  platform: NativePushPlatform;
  token: string;
  updatedAt: string;
  source: 'current' | 'refresh';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseObjectCandidate(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'string' && !value.trim()) {
    return null;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeNotificationData(value: unknown): Record<string, unknown> | null {
  const parsedData = parseObjectCandidate(value);

  if (!isRecord(parsedData)) {
    return null;
  }

  const fields = parseObjectCandidate(parsedData.fields);

  if (!isRecord(fields)) {
    return null;
  }

  return {
    ...parsedData,
    fields,
  };
}

function normalizeNotificationCandidate(candidate: unknown): INotification | null {
  const parsedCandidate = parseObjectCandidate(candidate);

  if (!isRecord(parsedCandidate)) {
    return null;
  }

  const notificationData = normalizeNotificationData(parsedCandidate.data)
    ?? normalizeNotificationData(parsedCandidate);

  if (!notificationData) {
    return null;
  }

  const id = toFiniteNumber(parsedCandidate.id);
  const userId = toFiniteNumber(parsedCandidate.user_id);
  const content = toNonEmptyString(parsedCandidate.content);
  const status = toNonEmptyString(parsedCandidate.status);
  const type = toNonEmptyString(parsedCandidate.type);
  const createdAt = toNonEmptyString(parsedCandidate.created_at);
  const updatedAt = toNonEmptyString(parsedCandidate.updated_at);
  const objectName = toNonEmptyString(notificationData.obj);
  const objectId = toFiniteNumber(notificationData.object_id);

  if (
    id === null
    || userId === null
    || !content
    || !status
    || !type
    || !createdAt
    || !updatedAt
    || !objectName
    || objectId === null
  ) {
    return null;
  }

  const fields = notificationData.fields as Record<string, unknown>;
  const fieldsType = toNonEmptyString(fields.type) ?? type;

  return {
    id,
    user_id: userId,
    content,
    status,
    type,
    created_at: createdAt,
    updated_at: updatedAt,
    data: {
      obj: objectName,
      object_id: objectId,
      fields: {
        ...fields,
        type: fieldsType,
      },
    },
  };
}

function collectPayloadCandidates(payload: unknown): unknown[] {
  const parsedPayload = parseObjectCandidate(payload);

  if (!isRecord(parsedPayload)) {
    return [parsedPayload];
  }

  const data = parseObjectCandidate(parsedPayload.data);
  const notification = parseObjectCandidate(parsedPayload.notification);
  const payloadValue = parseObjectCandidate(parsedPayload.payload);
  const raw = parseObjectCandidate(parsedPayload.raw);

  const candidates = [
    parsedPayload,
    data,
    notification,
    payloadValue,
    raw,
  ];

  if (isRecord(data)) {
    candidates.push(
      parseObjectCandidate(data.notification),
      parseObjectCandidate(data.notificationPayload),
      parseObjectCandidate(data.payload),
      parseObjectCandidate(data.raw),
      parseObjectCandidate(data.notification_payload),
      parseObjectCandidate(data.notification_payload_json),
      parseObjectCandidate(data.native_push_notification),
    );
  }

  return candidates;
}

function readTokenSyncState(storage: StorageLike): NativePushTokenSyncState {
  try {
    const rawState = storage.getItem(NATIVE_PUSH_TOKEN_SYNC_STATE_KEY);
    const parsedState = rawState ? JSON.parse(rawState) : null;

    if (isRecord(parsedState) && isRecord(parsedState.syncedAtByKey)) {
      return {
        syncedAtByKey: Object.fromEntries(
          Object.entries(parsedState.syncedAtByKey)
            .filter(([, value]) => typeof value === 'string'),
        ) as Record<string, string>,
      };
    }
  } catch {
    return { syncedAtByKey: {} };
  }

  return { syncedAtByKey: {} };
}

function writeTokenSyncState(storage: StorageLike, state: NativePushTokenSyncState) {
  storage.setItem(NATIVE_PUSH_TOKEN_SYNC_STATE_KEY, JSON.stringify(state));
}

export function isAndroidCapacitorRuntime(runtime: NativePushRuntimeInfo): boolean {
  return (
    runtime.isNativePlatform
    && runtime.platform === 'android'
    && (runtime.isMessagingPluginAvailable ?? runtime.isPushPluginAvailable) !== false
  );
}

export function getNativePushPlatform(runtime: NativePushRuntimeInfo): NativePushPlatform | null {
  if (
    !runtime.isNativePlatform
    || (runtime.isMessagingPluginAvailable ?? runtime.isPushPluginAvailable) === false
  ) {
    return null;
  }

  return runtime.platform === 'android' || runtime.platform === 'ios'
    ? runtime.platform
    : null;
}

export function isNativePushCapacitorRuntime(runtime: NativePushRuntimeInfo): boolean {
  return getNativePushPlatform(runtime) !== null;
}

export function resolveNativePushFlowAction(state: NativePushFlowState): NativePushFlowAction {
  if (!state.isEligible || !state.isAuthenticated) {
    return 'noop';
  }

  if (!state.explainerDecision) {
    return 'show-explainer';
  }

  if (state.explainerDecision === 'rejected' || state.permissionDecision === 'denied') {
    return 'noop';
  }

  if (state.explainerDecision === 'deferred') {
    return 'show-explainer';
  }

  if (state.permissionDecision === 'granted') {
    return 'register';
  }

  return 'request-permission';
}

export function readExplainerDecision(storage: StorageLike): NativePushExplainerDecision | null {
  const value = storage.getItem(NATIVE_PUSH_EXPLAINER_STATE_KEY);
  return value === 'accepted' || value === 'rejected' || value === 'deferred' ? value : null;
}

export function persistExplainerDecision(storage: StorageLike, decision: NativePushExplainerDecision) {
  storage.setItem(NATIVE_PUSH_EXPLAINER_STATE_KEY, decision);
}

export function readPermissionDecision(storage: StorageLike): NativePushPermissionDecision | null {
  const value = storage.getItem(NATIVE_PUSH_PERMISSION_STATE_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function persistPermissionDecision(storage: StorageLike, decision: NativePushPermissionDecision) {
  storage.setItem(NATIVE_PUSH_PERMISSION_STATE_KEY, decision);
}

export function createNativePushTokenSyncKey(
  userId: string,
  platform: NativePushPlatform,
  token: string,
): string {
  return `${encodeURIComponent(userId)}:${platform}:${encodeURIComponent(token)}`;
}

export function hasSyncedNativePushToken(
  storage: StorageLike,
  userId: string,
  platform: NativePushPlatform,
  token: string,
): boolean {
  const state = readTokenSyncState(storage);
  return Boolean(state.syncedAtByKey[createNativePushTokenSyncKey(userId, platform, token)]);
}

export function shouldSubscribeNativePushToken(
  storage: StorageLike,
  userId: string,
  platform: NativePushPlatform,
  token: string,
): boolean {
  return Boolean(userId && token && !hasSyncedNativePushToken(storage, userId, platform, token));
}

export function markNativePushTokenSynced(
  storage: StorageLike,
  userId: string,
  platform: NativePushPlatform,
  token: string,
  syncedAt = new Date().toISOString(),
) {
  const state = readTokenSyncState(storage);
  state.syncedAtByKey[createNativePushTokenSyncKey(userId, platform, token)] = syncedAt;
  writeTokenSyncState(storage, state);
}

function writeNativePushTokenState(
  storage: StorageLike,
  key: string,
  userId: string,
  platform: NativePushPlatform,
  token: string,
  source: NativePushTokenState['source'],
) {
  const state: NativePushTokenState = {
    userId,
    platform,
    token,
    source,
    updatedAt: new Date().toISOString(),
  };

  storage.setItem(key, JSON.stringify(state));
}

export function persistCurrentNativePushToken(
  storage: StorageLike,
  userId: string,
  platform: NativePushPlatform,
  token: string,
) {
  writeNativePushTokenState(storage, NATIVE_PUSH_CURRENT_TOKEN_STATE_KEY, userId, platform, token, 'current');
}

export function persistNativePushTokenRefresh(
  storage: StorageLike,
  userId: string,
  platform: NativePushPlatform,
  token: string,
) {
  writeNativePushTokenState(storage, NATIVE_PUSH_TOKEN_REFRESH_STATE_KEY, userId, platform, token, 'refresh');
}

export function clearNativePushTokenSyncState(storage: StorageLike) {
  storage.removeItem(NATIVE_PUSH_TOKEN_SYNC_STATE_KEY);
  storage.removeItem(NATIVE_PUSH_CURRENT_TOKEN_STATE_KEY);
  storage.removeItem(NATIVE_PUSH_TOKEN_REFRESH_STATE_KEY);
}

export function parseNativePushNotificationPayload(payload: unknown): NativePushPayloadParseResult {
  for (const candidate of collectPayloadCandidates(payload)) {
    const notification = normalizeNotificationCandidate(candidate);

    if (notification) {
      return { ok: true, notification };
    }
  }

  return {
    ok: false,
    reason: 'Native push payload did not include a full notification object.',
  };
}

export function getForegroundPushHandling(parseResult: NativePushPayloadParseResult): 'hydrate' | 'refresh' {
  return parseResult.ok ? 'hydrate' : 'refresh';
}

export function resolveNativePushDestination(
  destination: unknown,
  fallback = NATIVE_PUSH_NOTIFICATIONS_FALLBACK_PATH,
): string {
  return typeof destination === 'string' && destination.trim() ? destination : fallback;
}
