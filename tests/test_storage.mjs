/**
 * Extension storage tests — CRUD, free tier limit, duplicates.
 *
 * Run: node --test tests/test_storage.mjs
 * Requires: Node >= 18 (built-in --test runner)
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';

// Minimal chrome.storage mock
const store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: mock.fn((keys, cb) => {
        const result = {};
        for (const k of Array.isArray(keys) ? keys : [keys]) {
          if (k in store) result[k] = store[k];
        }
        return Promise.resolve(result);
      }),
      set: mock.fn((items) => {
        Object.assign(store, items);
        return Promise.resolve();
      }),
    },
  },
};

// Import after mocking chrome
const { getWatchedPages, addWatchedPage, removeWatchedPage } = await import('../lib/storage.ts');

describe('storage.ts', () => {
  beforeEach(() => {
    // Reset mock state
    for (const key of Object.keys(store)) delete store[key];
    chrome.storage.local.get.mock.resetCalls();
    chrome.storage.local.set.mock.resetCalls();
  });

  it('returns empty list when no pages stored', async () => {
    const pages = await getWatchedPages();
    assert.deepStrictEqual(pages, []);
  });

  it('adds a page and returns ok', async () => {
    const result = await addWatchedPage({ url: 'https://a.com', title: 'A' });
    assert.ok(result.ok);
    const pages = await getWatchedPages();
    assert.strictEqual(pages.length, 1);
    assert.strictEqual(pages[0].url, 'https://a.com');
    assert.ok(pages[0].addedAt > 0);
  });

  it('rejects duplicate URLs silently (returns ok, no duplicate)', async () => {
    await addWatchedPage({ url: 'https://a.com' });
    const result = await addWatchedPage({ url: 'https://a.com' });
    assert.ok(result.ok);
    const pages = await getWatchedPages();
    assert.strictEqual(pages.length, 1);
  });

  it('enforces free tier limit of 5 pages', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await addWatchedPage({ url: `https://page${i}.com` });
      assert.ok(r.ok);
    }
    const result = await addWatchedPage({ url: 'https://page6.com' });
    assert.ok(!result.ok);
    assert.match(result.error, /free tier/i);
    const pages = await getWatchedPages();
    assert.strictEqual(pages.length, 5);
  });

  it('allows adding after removing one', async () => {
    for (let i = 0; i < 5; i++) {
      await addWatchedPage({ url: `https://page${i}.com` });
    }
    await removeWatchedPage('https://page0.com');
    const result = await addWatchedPage({ url: 'https://new.com' });
    assert.ok(result.ok);
    const pages = await getWatchedPages();
    assert.strictEqual(pages.length, 5);
  });

  it('removes a page by URL', async () => {
    await addWatchedPage({ url: 'https://a.com' });
    await addWatchedPage({ url: 'https://b.com' });
    await removeWatchedPage('https://a.com');
    const pages = await getWatchedPages();
    assert.strictEqual(pages.length, 1);
    assert.strictEqual(pages[0].url, 'https://b.com');
  });

  it('remove on empty list does not error', async () => {
    await removeWatchedPage('https://anything.com');
    const pages = await getWatchedPages();
    assert.deepStrictEqual(pages, []);
  });
});
