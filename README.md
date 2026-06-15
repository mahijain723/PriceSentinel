# PriceSentinel

Pin competitor pricing pages and get notified when they change. A Chrome extension with a lightweight Python backend.

## Quick Start

### Extension (Chrome)

```bash
npm install
npx wxt build        # production build
npx wxt dev          # dev mode with HMR
```

Load the unpacked extension from `.output/chrome-mv3/` in Chrome (`chrome://extensions` → Load unpacked).

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Set the API URL in the extension's Settings page (right-click icon → Settings → enter `http://localhost:8000`).

## How It Works

1. **Pin a pricing page** — click the extension icon, click "Watch this page", optionally target a specific element with the CSS selector picker
2. **Backend polls** — checks the page on a schedule (default daily) using httpx (lightweight HTTP, no browser overhead)
3. **Changes detected?** — the HTML differ engine finds what changed, stores the diff, and sends notifications
4. **See the diff** — revisit the page to see changes highlighted inline, or check the extension popup for history

## Features

- **Local-first**: works offline via `chrome.storage`. Backend is optional for polling and notifications.
- **CSS selector targeting**: watch specific elements (e.g., `.pricing-card .price`) to ignore irrelevant changes
- **Change history**: expand any watched page in the popup to see past diffs
- **Notifications**: email (SMTP), Slack webhook, or Telegram bot alerts when prices change
- **No infrastructure costs**: SQLite + APScheduler + stdlib email = $0 third-party services
- **Free tier**: 5 watched pages (client-enforced)

## Tech Stack

| Layer | What | Why |
|-------|------|-----|
| Extension | WXT + Preact | 43 kB build, best MV3 DX |
| Backend | FastAPI + SQLite | Deployable on $5/mo VPS |
| Diff engine | Python `difflib` (stdlib) | Zero deps, built-in |
| Polling | APScheduler | In-process, no Redis needed |
| Page fetch | httpx | 11 MB vs 300 MB for Playwright |
| Notifications | smtplib + webhooks | stdlib email, direct Slack/Telegram POSTs |

## Project Structure

```
PriceSentinel/
├── entrypoints/        # Extension (WXT)
│   ├── background.ts   # Service worker
│   ├── content.ts      # Content script (diff overlay, picker)
│   ├── popup/          # Popup UI (Preact)
│   └── options/        # Settings page
├── lib/                # Shared extension modules
│   ├── storage.ts      # chrome.storage wrappers
│   ├── messaging.ts    # Message routing
│   └── api-client.ts   # Backend API client
├── backend/            # Python backend
│   ├── main.py         # FastAPI app
│   ├── models.py       # SQLAlchemy models
│   ├── routers/        # API endpoints
│   └── services/       # Fetcher, differ, notifier, scheduler, poll
└── public/             # Extension icons
```

## License

MIT
