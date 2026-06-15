export interface WatchedPage {
  url: string;
  title?: string;
  selector?: string;
  addedAt: number; // timestamp
}

const STORAGE_KEY = 'watched_pages';

export async function getWatchedPages(): Promise<WatchedPage[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

export async function addWatchedPage(page: Omit<WatchedPage, 'addedAt'>): Promise<{ ok: boolean; error?: string }> {
  const pages = await getWatchedPages();
  // Free tier: max 5 pages
  if (pages.length >= 5) {
    return { ok: false, error: 'Free tier limit: 5 pages. Upgrade to Pro for unlimited.' };
  }
  if (pages.some((p) => p.url === page.url)) return { ok: true }; // already added
  pages.push({ ...page, addedAt: Date.now() });
  await chrome.storage.local.set({ [STORAGE_KEY]: pages });
  return { ok: true };
}

export async function removeWatchedPage(url: string): Promise<void> {
  const pages = await getWatchedPages();
  await chrome.storage.local.set({
    [STORAGE_KEY]: pages.filter((p) => p.url !== url),
  });
}
