import { useState, useEffect } from 'preact/hooks';
import type { WatchedPage } from '~/lib/storage';

interface ChangeEntry {
  id: number;
  summary: string;
  created_at: string;
  diff: { type: string; text: string }[];
}

interface PageStatus {
  changes: number;
  lastChecked: string;
}

export function Popup() {
  const [pages, setPages] = useState<WatchedPage[]>([]);
  const [pageStatuses, setPageStatuses] = useState<Record<string, PageStatus>>({});
  const [loading, setLoading] = useState(true);
  const [currentTabUrl, setCurrentTabUrl] = useState('');
  const [currentTabTitle, setCurrentTabTitle] = useState('');
  const [selector, setSelector] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [pageChanges, setPageChanges] = useState<Record<string, ChangeEntry[]>>({});
  const [pollingPages, setPollingPages] = useState<Set<string>>(new Set());

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        setCurrentTabUrl(tab.url);
        setCurrentTabTitle(tab.title || tab.url);
      }
    });
    refreshData();
  }, []);

  useEffect(() => {
    const existing = pages.find((p) => p.url === currentTabUrl);
    setCurrentWatched(!!existing);
    if (existing?.selector) setSelector(existing.selector);
  }, [pages, currentTabUrl]);

  const [currentWatched, setCurrentWatched] = useState(false);

  function refreshData() {
    chrome.runtime.sendMessage({ type: 'GET_PAGES' }, (res) => {
      const watched = res?.pages ?? [];
      setPages(watched);
      setLoading(false);
    });
    chrome.runtime.sendMessage({ type: 'GET_CHANGE_COUNTS' }, (res) => {
      if (res?.statuses) setPageStatuses(res.statuses);
    });
  }

  const handleWatchPage = () => {
    chrome.runtime.sendMessage(
      { type: 'ADD_PAGE', url: currentTabUrl, title: currentTabTitle, selector: selector || undefined },
      () => refreshData(),
    );
  };

  const handleUnwatchPage = () => {
    chrome.runtime.sendMessage({ type: 'REMOVE_PAGE', url: currentTabUrl }, () => {
      setPages((prev) => prev.filter((p) => p.url !== currentTabUrl));
      setCurrentWatched(false);
      setSelector('');
    });
  };

  const handlePickFromPage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { type: 'ENTER_PICKER' });
        window.close();
      }
    });
  };

  const handleRemove = (url: string) => {
    chrome.runtime.sendMessage({ type: 'REMOVE_PAGE', url }, () => refreshData());
    if (expandedPage === url) setExpandedPage(null);
  };

  const handleCheckNow = async (url: string) => {
    setPollingPages((prev) => new Set(prev).add(url));
    chrome.runtime.sendMessage({ type: 'POLL_NOW', url }, () => {
      setPollingPages((prev) => { const n = new Set(prev); n.delete(url); return n; });
      refreshData();
    });
  };

  const toggleExpand = (url: string) => {
    if (expandedPage === url) { setExpandedPage(null); return; }
    setExpandedPage(url);
    if (!pageChanges[url]) {
      chrome.runtime.sendMessage({ type: 'GET_CHANGES', url }, (res) => {
        if (res?.changes) setPageChanges((prev) => ({ ...prev, [url]: res.changes }));
      });
    }
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div class="popup">
      <header>
        <h1>PriceSentinel</h1>
        <div class="header-right">
          <span class="badge-count">{pages.filter((p) => (pageStatuses[p.url]?.changes ?? 0) > 0).length} changed</span>
          <button class="btn btn-icon" onClick={refreshData} title="Refresh">↻</button>
        </div>
      </header>

      {currentTabUrl && (
        <div class="current-page">
          <span class="page-label">Current page</span>
          <span class="page-name">{currentTabTitle}</span>
          {currentWatched ? (
            <>
              {selector && <span class="selector-badge">CSS: {selector}</span>}
              <button class="btn btn-unwatch" onClick={handleUnwatchPage}>✕ Unwatch</button>
            </>
          ) : (
            <>
              <button class="btn btn-watch" onClick={handleWatchPage}>+ Watch this page</button>
              <button class="btn btn-outline" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? '− Less' : '+ Advanced'}
              </button>
              {showAdvanced && (
                <div class="advanced-section">
                  <label for="selector-input">CSS selector (optional)</label>
                  <div class="selector-row">
                    <input id="selector-input" class="input" type="text"
                      placeholder=".pricing-card .price" value={selector}
                      onInput={(e) => setSelector((e.target as HTMLInputElement).value)} />
                    <button class="btn btn-pick" onClick={handlePickFromPage}>Pick</button>
                  </div>
                  <p class="help-text">Target a specific element. Leave empty to watch the whole page.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {loading && <p class="status">Loading...</p>}

      {!loading && pages.length === 0 && <p class="empty">No pages watched yet. Visit a pricing page and click "Watch this page".</p>}

      <ul class="page-list">
        {pages.map((page) => {
          const status = pageStatuses[page.url];
          const changeCount = status?.changes ?? 0;
          const isPolling = pollingPages.has(page.url);
          const isExpanded = expandedPage === page.url;
          const changes = pageChanges[page.url] ?? [];

          return (
            <li key={page.url} class={isExpanded ? 'expanded' : ''}>
              <div class="page-row" onClick={() => changeCount > 0 && toggleExpand(page.url)}>
                <div class="page-info">
                  <span class="page-title">{page.title || page.url}</span>
                  <span class="page-url">{page.url}</span>
                  {status?.lastChecked && <span class="last-checked">checked {timeAgo(status.lastChecked)}</span>}
                </div>
                <div class="page-actions">
                  {changeCount > 0 && <span class="change-badge">{changeCount} change{changeCount !== 1 ? 's' : ''}</span>}
                  <button class="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleCheckNow(page.url); }}
                    disabled={isPolling}>{isPolling ? '…' : 'Check'}</button>
                  <button class="remove-btn" onClick={(e) => { e.stopPropagation(); handleRemove(page.url); }}>✕</button>
                </div>
              </div>
              {isExpanded && (
                <div class="change-list">
                  {changes.length === 0 && <p class="no-changes">No changes yet.</p>}
                  {changes.map((c) => (
                    <div key={c.id} class="change-entry">
                      <div class="change-summary">{c.summary}</div>
                      <div class="change-time">{timeAgo(c.created_at)}</div>
                      {c.diff.filter((d) => d.type !== 'unchanged').slice(0, 5).map((seg, i) => (
                        <div key={i} class={`diff-segment diff-${seg.type}`}>{seg.text.slice(0, 120)}</div>
                      ))}
                      {c.diff.filter((d) => d.type !== 'unchanged').length > 5 &&
                        <div class="more-diff">… and {c.diff.filter((d) => d.type !== 'unchanged').length - 5} more</div>}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <footer>
        <a href="#" onClick={(e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); }}>Settings</a>
      </footer>
    </div>
  );
}
