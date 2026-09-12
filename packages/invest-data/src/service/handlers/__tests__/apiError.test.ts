import {
  describe,
  expect,
  it,
} from 'vitest';
import { APIError } from '../apiError.ts';

describe('APIError', () => {
  it('uses displayable JSON response details when available', async () => {
    const error = new APIError(
      'Failed to fetch data',
      new Response(JSON.stringify({
        ui: {
          messages: [{ type: 'error', text: 'Profile is locked' }],
        },
      }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await error.initializeResponseJson();

    expect(error.name).toBe('APIError');
    expect(error.message).toBe('Profile is locked');
    expect(error.isClientError()).toBe(true);
    expect(error.isServerError()).toBe(false);
  });

  it('normalizes the aiohttp error envelope without changing the raw response JSON', async () => {
    const responseJson = {
      error: {
        status: 400,
        message: 'Bad Request',
        details: { amount: ['Amount must be at least 100'] },
      },
    };
    const error = new APIError(
      'Failed to create investment',
      new Response(JSON.stringify(responseJson), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await error.initializeResponseJson();

    expect(error.message).toBe('Amount must be at least 100');
    expect(error.data.responseJson).toEqual(responseJson);
  });

  it('prefers useful envelope details over a generic nested message', async () => {
    const error = new APIError(
      'Fallback message',
      new Response(JSON.stringify({
        error: {
          message: 'Bad Request',
          details: 'The submitted profile is incomplete',
        },
      }), { status: 400 }),
    );

    await error.initializeResponseJson();

    expect(error.message).toBe('The submitted profile is incomplete');
  });

  it('combines a direct envelope detail string array', async () => {
    const error = new APIError(
      'Fallback message',
      new Response(JSON.stringify({
        error: {
          message: 'Bad Request',
          details: ['First detail', '', null, 'Second detail'],
        },
      }), { status: 400 }),
    );

    await error.initializeResponseJson();

    expect(error.message).toBe('First detail; Second detail');
  });

  it.each([
    undefined,
    null,
    '',
    [],
    {},
    { amount: null, profile: false, count: 2 },
  ])('falls back to the nested message when details are empty or malformed: %o', async (details) => {
    const error = new APIError(
      'Fallback message',
      new Response(JSON.stringify({
        error: { message: 'Specific nested message', details },
      }), { status: 422 }),
    );

    await error.initializeResponseJson();

    expect(error.message).toBe('Specific nested message');
  });

  it('combines multiple detail messages in field-map order', async () => {
    const error = new APIError(
      'Fallback message',
      new Response(JSON.stringify({
        error: {
          message: 'Bad Request',
          details: {
            first_name: ['First name is required', 'First name is invalid'],
            email: 'Email is already registered',
            ignored: { message: 'Do not render objects' },
          },
        },
      }), { status: 400 }),
    );

    await error.initializeResponseJson();

    expect(error.message).toBe(
      'First name is required; First name is invalid; Email is already registered',
    );
  });

  it('keeps legacy root-message precedence over envelope and Ory messages', async () => {
    const error = new APIError(
      'Fallback message',
      new Response(JSON.stringify({
        __error__: ['Primary legacy error', 'Secondary legacy error'],
        message: 'Root message',
        error: { details: 'Envelope detail', message: 'Nested message' },
        ui: { messages: [{ type: 'error', text: 'Ory message' }] },
      }), { status: 400 }),
    );

    await error.initializeResponseJson();

    expect(error.message).toBe('Primary legacy error; Secondary legacy error');
  });

  it('keeps a legacy root message ahead of envelope and Ory messages', async () => {
    const error = new APIError(
      'Fallback message',
      new Response(JSON.stringify({
        message: 'Root message',
        error: { details: 'Envelope detail', message: 'Nested message' },
        ui: { messages: [{ type: 'error', text: 'Ory message' }] },
      }), { status: 400 }),
    );

    await error.initializeResponseJson();

    expect(error.message).toBe('Root message');
  });

  it('keeps Ory node-message fallback behavior', async () => {
    const error = new APIError(
      'Fallback message',
      new Response(JSON.stringify({
        ui: {
          nodes: [{ messages: [{ type: 'error', text: 'Ory node message' }] }],
        },
      }), { status: 400 }),
    );

    await error.initializeResponseJson();

    expect(error.message).toBe('Ory node message');
  });
});
