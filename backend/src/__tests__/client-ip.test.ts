import type { Request } from 'express';

const SECRET = 'proxy-secret-that-is-at-least-32-chars!!';

function fakeRequest(headers: Record<string, string>, remoteAddress = '10.0.0.9'): Request {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    get: (name: string) => lower[name.toLowerCase()],
    socket: { remoteAddress },
  } as unknown as Request;
}

/** Loads client-ip.ts against a fresh env so each case can vary PROXY_SECRET / FLY_APP_NAME. */
function loadClientIp(env: { PROXY_SECRET?: string; FLY_APP_NAME?: string }) {
  const saved = { ...process.env };
  delete process.env.PROXY_SECRET;
  delete process.env.FLY_APP_NAME;
  Object.assign(process.env, env);
  let fn!: (req: Request) => string;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fn = require('../lib/client-ip').clientIp;
  });
  process.env = saved;
  return fn;
}

describe('clientIp', () => {
  it('trusts the proxy-forwarded IP only with the right secret', () => {
    const clientIp = loadClientIp({ PROXY_SECRET: SECRET });
    expect(clientIp(fakeRequest({ 'X-Proxy-Auth': SECRET, 'X-Client-IP': '203.0.113.7' }))).toBe(
      '203.0.113.7',
    );
    expect(clientIp(fakeRequest({ 'X-Proxy-Auth': 'guess', 'X-Client-IP': '203.0.113.7' }))).toBe(
      '10.0.0.9',
    );
    expect(clientIp(fakeRequest({ 'X-Client-IP': '203.0.113.7' }))).toBe('10.0.0.9');
  });

  it('never trusts forwarded headers when no secret is configured', () => {
    const clientIp = loadClientIp({});
    expect(clientIp(fakeRequest({ 'X-Proxy-Auth': '', 'X-Client-IP': '203.0.113.7' }))).toBe(
      '10.0.0.9',
    );
  });

  it('uses Fly-Client-IP only when running on Fly.io', () => {
    expect(loadClientIp({})(fakeRequest({ 'Fly-Client-IP': '198.51.100.4' }))).toBe('10.0.0.9');
    expect(
      loadClientIp({ FLY_APP_NAME: 'questlog-api' })(fakeRequest({ 'Fly-Client-IP': '198.51.100.4' })),
    ).toBe('198.51.100.4');
  });
});
