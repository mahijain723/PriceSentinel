import { defineBackground } from 'wxt/utils/define-background';
import { getWatchedPages, addWatchedPage, removeWatchedPage } from '~/lib/storage';
import { registerPage, unregisterPage, getChangeCounts, pollNow, getChangesForPage } from '~/lib/api-client';

export default defineBackground(() => {
  // Create right-click context menu on install
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

  // Handle context menu clicks
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

  // Handle messages from popup, content script, and alarm
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case 'ADD_PAGE':
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
        removeWatchedPage(msg.url)
          .then(() => unregisterPage(msg.url).catch(() => {}))
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;

      case 'GET_PAGES':
        getWatchedPages().then((pages) => sendResponse({ pages }));
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
        getChangeCounts().then((counts) => {
          const statuses: Record<string, { changes: number; lastChecked: string }> = {};
          for (const [url, count] of Object.entries(counts)) {
            statuses[url] = { changes: count, lastChecked: new Date().toISOString() };
          }
          sendResponse({ statuses });
        }).catch(() => sendResponse({ statuses: {} }));
        return true;

      case 'POLL_NOW':
        pollNow(msg.url)
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;

      case 'GET_CHANGES':
        getChangesForPage(msg.url).then(async (res) => {
          if (!res.ok) { sendResponse({ changes: [] }); return; }
          const changes = await res.json();
          sendResponse({ changes });
        }).catch(() => sendResponse({ changes: [] }));
        return true;

      case 'OPEN_POPUP':
        chrome.action.openPopup();
        return false;
    }
  });

  // Set badge text on alarm heartbeat
  chrome.alarms.onAlarm.addListener(() => {
    getChangeCounts().then((counts) => {
      const total = Object.values(counts).reduce((s, c) => s + c, 0);
      chrome.action.setBadgeText({ text: total > 0 ? String(total) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#e53e3e' });
    }).catch(() => {});
  });

  // Sync all watched pages to backend on startup
  chrome.runtime.onStartup?.addListener(() => {
    getWatchedPages().then((pages) => {
      for (const p of pages) {
        registerPage(p.url, p.title, p.selector).catch(() => {});
      }
    });
  });

  chrome.alarms.create('heartbeat', { periodInMinutes: 15 });
});
