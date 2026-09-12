import {
  normalizeClientError,
} from '@global-torque/client-error-handling/normalize';
import type { NormalizedClientError } from '@global-torque/client-error-handling/types';

import type { NormalizedError } from './errorReporterCore.ts';

export interface RuntimeTransportErrorContext {
  readonly source?: string;
  readonly component?: string;
  readonly route?: string;
  readonly request?: {
    readonly method?: string;
    readonly url?: string;
  };
  readonly stack?: readonly string[];
  readonly filename?: string;
  readonly lineno?: number;
  readonly colno?: number;
  readonly unhandledRejection?: boolean;
}

const RUNTIME_METADATA_KEYS = [
  'source',
  'code',
  'statusCode',
  'filename',
  'lineno',
  'colno',
  'unhandledRejection',
] as const;

/**
 * Convert the legacy runtime error summary into the public package's bounded,
 * body-free transport contract before it reaches an analytics adapter.
 */
export function createRuntimeTransportSafeError(
  normalized: NormalizedError,
  fallbackMessage: string,
  context: RuntimeTransportErrorContext = {},
): NormalizedClientError {
  const combinedMessage = [fallbackMessage, normalized.message]
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .join(': ');
  const stack = context.stack?.join('\n');
  const diagnostic = {
    name: 'RuntimeClientError',
    message: combinedMessage || 'Runtime client error',
    ...(stack ? { stack } : {}),
  };

  return normalizeClientError(
    diagnostic,
    {
      route: context.route,
      component: context.component,
      request: context.request,
      metadata: {
        source: context.source,
        code: normalized.code,
        statusCode: normalized.statusCode,
        filename: context.filename,
        lineno: context.lineno,
        colno: context.colno,
        unhandledRejection: context.unhandledRejection,
      },
    },
    {
      sanitize: {
        allowedMetadataKeys: RUNTIME_METADATA_KEYS,
        maxStringLength: 500,
        maxTotalBytes: 8_192,
      },
      maxStackFrames: 15,
    },
  );
}
