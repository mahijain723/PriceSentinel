import { defineBackground } from 'wxt/utils/define-background';
import { getWatchedPages, addWatchedPage, removeWatchedPage } from '~/lib/storage';
import { registerPage, unregisterPage, getChangeCounts, pollNow, getChangesForPage } from '~/lib/api-client';

/* ── In-memory cache ─────────────────────────────────── */
// ponytail: simple TTL dict prevents unnecessary chrome.storage reads
// on consecutive popup opens. Cache is lost on service worker idle — acceptable.
interface CacheEntry<T> {
  data: T;
  at: number;
}
const TTL = 30_000; // 30 seconds

const caches: Record<string, CacheEntry<unknown>> = {};
let gen = 0; // stale-response guard

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  gen++;
  const tag = gen;
  const hit = caches[key] as CacheEntry<T> | undefined;
  if (hit && (Date.now() - hit.at) < TTL) {
    return Promise.resolve(hit.data);
  }
  return fn().then((data) => {
    if (tag === gen) { // only cache freshest response
      caches[key] = { data, at: Date.now() };
    }
    return data;
  });
}

function invalidate(key?: string) {
  if (key) {
    delete caches[key];
  } else {
    Object.keys(caches).forEach((k) => delete caches[k]);
  }
}

/* ── Helpers ─────────────────────────────────────────── */

function fetchStatuses(): Promise<Record<string, { changes: number; lastChecked: string }>> {
  return getChangeCounts().then((counts) => {
    const statuses: Record<string, { changes: number; lastChecked: string }> = {};
    for (const [url, count] of Object.entries(counts)) {
      statuses[url] = { changes: count, lastChecked: new Date().toISOString() };
    }
    return statuses;
  });
}

/* ── Main ────────────────────────────────────────────── */

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    chrome.contextMenus.create({
      id: 'watch-page',
      title: 'Watch this page with PriceSentinel',
      contexts: ['page', 'link'],
    });
    if (details.reason === 'install') {
      console.log('[PriceSentinel] Installed');
    }
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    const url = info.linkUrl || info.pageUrl;
    if (info.menuItemId === 'watch-page' && url) {
      addWatchedPage({ url })
        .then(() => registerPage(url).catch(() => {}))
        .then(() => {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon-48.png',
            title: 'PriceSentinel',
            message: `Now watching: ${url}`,
          });
        });
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case 'ADD_PAGE':
        invalidate(); // full cache clear — data changed
        addWatchedPage({ url: msg.url, title: msg.title, selector: msg.selector })
          .then((result) => {
            if (!result.ok) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: '/icons/icon-48.png',
                title: 'PriceSentinel',
                message: result.error || 'Failed to add page',
              });
              return sendResponse({ ok: false, error: result.error });
            }
            registerPage(msg.url, msg.title, msg.selector).catch(() => {});
            return sendResponse({ ok: true });
          })
          .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;

      case 'REMOVE_PAGE':
        invalidate();
        removeWatchedPage(msg.url)
          .then(() => unregisterPage(msg.url).catch(() => {}))
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;

      case 'GET_PAGES':
        cached('pages', getWatchedPages).then((pages) => sendResponse({ pages }));
        return true;

      case 'CHECK_PAGE':
        getWatchedPages().then((pages) => {
          const watched = pages.find((p) => p.url === msg.url);
          sendResponse({ watched: !!watched, page: watched || null });
        });
        return true;

      case 'GET_BACKEND_STATUS':
        import('~/lib/api-client').then((api) =>
          api.getConfig().then((cfg) =>
            sendResponse({ configured: !!cfg.apiUrl, apiUrl: cfg.apiUrl })
          )
        );
        return true;

      case 'GET_CHANGE_COUNTS':
        cached('statuses', fetchStatuses).then((statuses) => sendResponse({ statuses }));
        return true;

      case 'POLL_NOW':
        pollNow(msg.url)
          .then(() => {
            invalidate();
            sendResponse({ ok: true });
          })
          .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;

      case 'GET_CHANGES':
        {
          const cacheKey = `changes:${msg.url}`;
          cached(cacheKey, () =>
            getChangesForPage(msg.url).then(async (res) => {
              if (!res.ok) return [];
              const changes = await res.json();
              // Truncate diff payload on the client side too:
              // only keep the first 5 meaningful segments for the popup view.
              return changes.map((c: { diff?: { type: string; text: string }[] }) => ({
                ...c,
                diff: c.diff?.filter((d: { type: string }) => d.type !== 'unchanged').slice(0, 5) ?? [],
              }));
            })
          ).then((changes) => sendResponse({ changes }));
        }
        return true;

      case 'OPEN_POPUP':
        chrome.action.openPopup();
        return false;
    }
  });

  // Update badge text on alarm heartbeat
  chrome.alarms.onAlarm.addListener(() => {
    getChangeCounts().then((counts) => {
      const total = Object.values(counts).reduce((s, c) => s + c, 0);
      chrome.action.setBadgeText({ text: total > 0 ? String(total) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#e53e3e' });
    }).catch(() => {});
  });

  // Sync watched pages to backend on browser startup
  chrome.runtime.onStartup?.addListener(() => {
    getWatchedPages().then((pages) => {
      for (const p of pages) {
        registerPage(p.url, p.title, p.selector).catch(() => {});
      }
    });
  });

  chrome.alarms.create('heartbeat', { periodInMinutes: 15 });
});
