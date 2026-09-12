export class OfflineRequestError extends Error {
  readonly code = 'OFFLINE_MUTATION_BLOCKED';

  readonly method: string;

  readonly url: string;

  constructor(method: string, url: string) {
    super('This action requires an internet connection. Reconnect and try again.');
    this.name = 'OfflineRequestError';
    this.method = method;
    this.url = url;
  }
}
