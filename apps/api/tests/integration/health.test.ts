import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/index';

describe('Integration: Health Check Route', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.payload);
    expect(json).toEqual({ status: 'ok' });
  });
});

