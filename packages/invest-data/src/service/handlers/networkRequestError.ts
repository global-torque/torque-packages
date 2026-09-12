import type { AnalyticsBody } from '@webdevelop-pro/domain-types/analyticsTypes';
import type { APIErrorData } from './apiError.ts';

export interface NetworkRequestErrorData {
  timestamp: Date;
  status: number;
  statusCode: number;
  responseJson: null;
  stack: string;
  body: AnalyticsBody;
  httpRequest: APIErrorData['httpRequest'];
  causeMessage: string;
  retryable: boolean;
  attempts: number;
}

const getSafeCause = (cause: unknown): Readonly<{ name: string }> => Object.freeze({
  name: cause instanceof Error && /^[A-Za-z][A-Za-z\d]{0,63}$/u.test(cause.name)
    ? cause.name
    : 'Error',
});

export class NetworkRequestError extends Error {
  public readonly data: NetworkRequestErrorData;

  public readonly cause: unknown;

  public readonly isNetworkError = true;

  constructor(
    cause: unknown,
    httpRequest: APIErrorData['httpRequest'],
    body: AnalyticsBody = {},
    options: {
      retryable?: boolean;
      attempts?: number;
    } = {},
  ) {
    super('Network request failed');

    const errorConstructor = Error as ErrorConstructor & {
      captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
    };
    if (errorConstructor.captureStackTrace) {
      errorConstructor.captureStackTrace(this, NetworkRequestError);
    }

    this.name = 'NetworkRequestError';
    Object.defineProperty(this, 'cause', {
      configurable: false,
      enumerable: false,
      value: getSafeCause(cause),
      writable: false,
    });
    this.data = {
      timestamp: new Date(),
      status: 0,
      statusCode: 0,
      responseJson: null,
      stack: '',
      body,
      httpRequest,
      causeMessage: 'Network transport failed',
      retryable: options.retryable ?? false,
      attempts: options.attempts ?? 1,
    };
  }
}
