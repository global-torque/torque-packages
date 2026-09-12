export const AnalyticsLogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
} as const;

export type AnalyticsLogLevel = typeof AnalyticsLogLevel[keyof typeof AnalyticsLogLevel];

export type AnalyticsEventType =
  | 'open'
  | 'click'
  | 'send'
  | 'close';

export type AnalyticsHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
export type AnalyticsBody = Record<string, unknown>;

export interface IHttpRequest {
  method: string;
  url: string;
  path: string;
  userAgent: string;
  referer: string;
  remoteIp: string;
  protocol: string;
}

export interface IServiceContext {
  httpRequest: IHttpRequest;
  version?: string;
  build_timestamp?: string;
  user?: string;
  request_id?: string;
  service_name?: string;
  event_source?: 'client' | 'server';
  frontend_env?: string;
}

export interface IServiceContextEvent {
  httpRequest: {
    method: AnalyticsHttpMethod;
    url: string;
    userAgent: string;
    referer: string;
    remoteIp: string;
    protocol: string;
  };
  user: string;
  request_id: string;
  service_name: string;
  version: string;
}

export interface IAnalyticsData {
  component: string;
  caller: string[];
  stack: string[];
  serviceContext: IServiceContext;
  client?: IClientContext;
  context?: IAnalyticsClientErrorContext;
}

export type AnalyticsClientErrorSource =
  | 'caught'
  | 'global'
  | 'vue'
  | 'vitepress'
  | 'api'
  | 'chunk'
  | 'manual';

export interface IAnalyticsRouteContext {
  path?: string;
  name?: string;
}

export interface IAnalyticsHttpErrorContext {
  method?: string;
  url?: string;
  path?: string;
  status?: number;
  statusCode?: number;
  responseSource?: 'http' | 'network' | 'offline-cache' | 'cache' | 'unknown';
  offline?: boolean;
}

export interface IAnalyticsErrorEventContext {
  filename?: string;
  lineno?: number;
  colno?: number;
  message?: string;
  tagName?: string;
  resourceUrl?: string;
  opaqueScriptError?: boolean;
}

export interface IAnalyticsPromiseRejectionContext {
  reasonType?: string;
  reasonMessage?: string;
}

export interface IAnalyticsRuntimeContext {
  frontendEnv?: string;
  isStaticSite?: boolean;
  isDev?: boolean;
  buildVersion?: string;
  buildTimestamp?: string;
}

export interface IAnalyticsClientErrorContext {
  source?: AnalyticsClientErrorSource;
  route?: IAnalyticsRouteContext;
  http?: IAnalyticsHttpErrorContext;
  errorEvent?: IAnalyticsErrorEventContext;
  promiseRejection?: IAnalyticsPromiseRejectionContext;
  runtime?: IAnalyticsRuntimeContext;
}

export interface IViewportInfo {
  width?: number;
  height?: number;
}

export interface IScreenInfo {
  width?: number;
  height?: number;
  availWidth?: number;
  availHeight?: number;
  colorDepth?: number;
  pixelRatio?: number;
}

export interface IOrientationInfo {
  type?: string;
  angle?: number;
}

export interface IClientContext {
  userAgent?: string;
  language?: string;
  languages?: readonly string[];
  onLine?: boolean;
  timeZone?: string;
  viewport?: IViewportInfo;
  screen?: IScreenInfo;
  orientation?: IOrientationInfo;
}

export interface IAnalyticsMessage {
  time: string;
  level: AnalyticsLogLevel;
  message: string;
  error: string;
  body: AnalyticsBody;
  data: IAnalyticsData;
}

export interface IAnalyticsEventRequest {
  event_type: AnalyticsEventType;
  method: AnalyticsHttpMethod;
  status_code: number;
  identity_id: string;
  request_path: string;
  body: AnalyticsBody;
  service_context: IServiceContextEvent;
}

export interface IAnalyticsResponse {
  success: boolean;
  message: string;
  id?: string;
}

export interface IAnalyticsError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface AnalyticsClient {
  logMessage(message: IAnalyticsMessage): Promise<IAnalyticsResponse>;
  trackEvent(event: IAnalyticsEventRequest): Promise<IAnalyticsResponse>;
}
