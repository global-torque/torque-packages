import type { AnalyticsBody } from '@global-torque/domain-types/analyticsTypes';

export interface APIErrorData {
  timestamp: Date;
  response: Response;
  statusCode: number;
  /** Parsed JSON body when content-type is application/json; null otherwise. */
  responseJson: APIErrorResponseJson | null;
  stack: string;
  body: AnalyticsBody;
  httpRequest: {
    method: string;
    url: string;
    path: string;
    userAgent: string;
    referer: string;
    remoteIp: string;
    protocol: string;
  };
}

/** Minimal shape for error response bodies we know how to display. */
export interface APIErrorResponseJson {
  message?: string;
  __error__?: string | string[];
  error?: {
    status?: number;
    message?: string;
    details?: unknown;
  };
  ui?: {
    messages?: Array<{ type?: string; text?: string }>;
    nodes?: Array<{ messages?: Array<{ type?: string; text?: string }> }>;
  };
}

export class APIError extends Error {
  public data: APIErrorData;
  /** When true, the global error handler may treat this as fatal (e.g. redirect to /500). */
  public isFatal?: boolean;
  /** When true (default), non-fatal 5xx errors may show a global alert banner. */
  public showGlobalAlertOnServerError?: boolean;

  constructor(
    message: string,
    response: Response,
    httpRequest?: APIErrorData['httpRequest'],
    body: AnalyticsBody = {},
  ) {
    super(message);

    // Maintains proper stack trace (only in V8 engines)
    const errorConstructor = Error as ErrorConstructor & {
      captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
    };
    if (errorConstructor.captureStackTrace) {
      errorConstructor.captureStackTrace(this, APIError);
    }

    this.name = 'APIError';
    this.data = {
      timestamp: new Date(),
      response: response.clone(),
      statusCode: response.status,
      responseJson: null,
      stack: '',
      body,
      httpRequest: httpRequest || {
        method: '',
        url: '',
        path: '',
        userAgent: '',
        referer: '',
        remoteIp: '',
        protocol: '',
      },
    };
  }

  /**
   * Parse response body as JSON and set message from it.
   * Must be awaited before throwing or reading message/responseJson (e.g. apiClient calls this before throw).
   */
  public async initializeResponseJson(): Promise<void> {
    try {
      const json = await this.data.response.clone().json();
      this.data.responseJson = json as APIErrorResponseJson;
      this.message = this.getDetailedMessage();
    } catch {
      this.data.responseJson = null;
    }
  }

  getDetailedMessage(): string {
    const { responseJson } = this.data;
    if (!responseJson || typeof responseJson !== 'object') {
      return this.message;
    }
    const ui = responseJson.ui;
    const uiMessage = ui?.messages?.find((m) => m.type === 'error')?.text;
    const uiNodeMessage = ui?.nodes?.find((node) =>
      node.messages?.some((m) => m.type === 'error'),
    )?.messages?.find((m) => m.type === 'error')?.text;

    const toMessages = (value: unknown): string[] => {
      const values = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
      return values
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    };
    const detailMessages = (() => {
      const details = responseJson.error?.details;
      const directMessages = toMessages(details);
      if (directMessages.length) return directMessages;
      if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
      return Object.values(details).flatMap(toMessages);
    })();
    const nestedMessage = typeof responseJson.error?.message === 'string'
      ? responseJson.error.message.trim()
      : '';

    if (Array.isArray(responseJson.__error__)) {
      return responseJson.__error__.join('; ');
    }

    return (
      (typeof responseJson.__error__ === 'string' ? responseJson.__error__ : null)
      ?? responseJson.message
      ?? (detailMessages.length ? detailMessages.join('; ') : null)
      ?? (nestedMessage || null)
      ?? uiMessage
      ?? uiNodeMessage
      ?? this.message
    );
  }

  isClientError(): boolean {
    return this.data.statusCode >= 400 && this.data.statusCode < 500;
  }

  isServerError(): boolean {
    return this.data.statusCode >= 500;
  }
}
