import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../index'; // Import from src/index.ts

describe('Authentication Routes & Middlewares', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should accept application/x-www-form-urlencoded payloads for auth endpoints', async () => {
    // Send a payload to a NextAuth route to ensure formbody parses it properly without a 415 error
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/callback/credentials',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      // Fastify inject allows testing string payloads
      payload: 'email=admin%40tablediner.com&password=password123&redirect=false',
    });

    // 415 Unsupported Media Type is what we are verifying does NOT happen
    expect(response.statusCode).not.toBe(415);
    
    // Auth.js will likely return a 302 redirect or a JSON structure if redirect=false, 
    // or maybe 500 if CSRF token is missing in the test, but the key is that 
    // it parsed the request past the Fastify body parser stage.
    expect(
      response.statusCode === 200 || 
      response.statusCode === 302 || 
      response.statusCode === 400 ||
      response.statusCode === 401 ||
      response.statusCode === 500
    ).toBe(true);
  });
});

