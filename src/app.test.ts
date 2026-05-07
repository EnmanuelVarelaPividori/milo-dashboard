import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('app', () => {
  it('returns health status', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });

  it('returns service info', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ service: 'milo-dashboard', status: 'ok' });

    await app.close();
  });
});
