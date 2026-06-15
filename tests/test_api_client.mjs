/**
 * API client tests — URL construction, network failure handling, config.
 *
 * Run: node --experimental-strip-types --test tests/test_api_client.mjs
 * Requires: Node >= 22 (for TS strip-types support)
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

let _apiUrl = 'http://localhost:8000';

globalThis.chrome = {
  storage: {
    sync: {
      get: mock.fn((_keys) => {
        return Promise.resolve({ apiUrl: _apiUrl });
      }),
    },
  },
};

const { registerPage, unregisterPage, getChangeCounts, pollNow, getChangesForPage } =
  await import('../lib/api-client.ts');

describe('api-client.ts', () => {
  beforeEach(() => {
    globalThis.fetch = mock.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );
    _apiUrl = 'http://localhost:8000';
    chrome.storage.sync.get = mock.fn((_keys) => {
      return Promise.resolve({ apiUrl: _apiUrl });
    });
  });

  it('registerPage sends correct POST request', async () => {
    await registerPage('https://example.com', 'Example', '.price');
    const call = fetch.mock.calls[0];
    assert.ok(call.arguments[0].includes('/pages'));
    assert.strictEqual(call.arguments[1].method, 'POST');
    const body = JSON.parse(call.arguments[1].body);
    assert.strictEqual(body.url, 'https://example.com');
    assert.strictEqual(body.title, 'Example');
    assert.strictEqual(body.selector, '.price');
  });

  it('registerPage throws when no API URL configured', async () => {
    _apiUrl = '';
    await assert.rejects(
      () => registerPage('https://example.com'),
      /not configured/i
    );
  });

  it('getChangeCounts returns empty object on network failure', async () => {
    globalThis.fetch = mock.fn(() => Promise.reject(new Error('Network error')));
    const counts = await getChangeCounts();
    assert.deepStrictEqual(counts, {});
  });

  it('getChangeCounts returns empty object on non-ok response', async () => {
    globalThis.fetch = mock.fn(() =>
      Promise.resolve(new Response('', { status: 500 }))
    );
    const counts = await getChangeCounts();
    assert.deepStrictEqual(counts, {});
  });

  it('pollNow sends correct POST request', async () => {
    await pollNow('https://example.com');
    const call = fetch.mock.calls[0];
    assert.ok(call.arguments[0].includes('/pages/poll'));
    assert.strictEqual(call.arguments[1].method, 'POST');
    const body = JSON.parse(call.arguments[1].body);
    assert.strictEqual(body.url, 'https://example.com');
  });

  it('getChangesForPage encodes URL parameter', async () => {
    await getChangesForPage('https://example.com/pricing?plan=pro');
    const url = fetch.mock.calls[0].arguments[0];
    assert.ok(url.includes('/changes'));
    assert.ok(url.includes('url='));
    assert.ok(url.includes('%3F')); // encoded ?
  });
});
