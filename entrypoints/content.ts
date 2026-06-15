import { defineContentScript } from 'wxt/utils/define-content-script';

/**
 * Generate a CSS selector for the given element.
 * Strategy: id → unique class → nth-child path
 */
function getSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parent = el.parentElement;
  if (!parent || parent === document.body || parent === document.documentElement) {
    const tag = el.tagName.toLowerCase();
    const idx = [...parent?.children ?? document.body.children].indexOf(el) + 1;
    return `${tag}:nth-child(${idx})`;
  }

  // Try classes
  const classes = [...el.classList].filter((c) => !c.startsWith('pricesentinel'));
  if (classes.length > 0) {
    const classSel = classes.map((c) => `.${CSS.escape(c)}`).join('');
    const matches = document.querySelectorAll(classSel);
    if (matches.length === 1) return classSel;
    if (matches.length < 10) {
      const idx = [...matches].indexOf(el as HTMLElement) + 1;
      return `${classSel}:nth-of-type(${idx})`;
    }
  }

  // Fallback: nth-child path
  const tag = el.tagName.toLowerCase();
  const idx = [...parent.children].indexOf(el) + 1;
  const parentSel = getSelector(parent);
  return `${parentSel} > ${tag}:nth-child(${idx})`;
}

let pickerActive = false;
let styleEl: HTMLStyleElement | null = null;

function enterPickerMode() {
  pickerActive = true;

  styleEl = document.createElement('style');
  styleEl.textContent = `
    .ps-picker-highlight {
      outline: 3px solid #6366f1 !important;
      outline-offset: 2px !important;
      background: rgba(99, 102, 241, 0.08) !important;
      cursor: crosshair !important;
    }
    .ps-picker-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: #1a1a2e;
      color: #fff;
      padding: 12px 20px;
      border-radius: 10px;
      font: 14px/1.4 system-ui, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      animation: ps-fade-in 0.3s;
    }
    @keyframes ps-fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(styleEl);

  document.addEventListener('mousemove', onHover, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown, true);
}

function exitPickerMode() {
  pickerActive = false;
  document.removeEventListener('mousemove', onHover, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeydown, true);
  styleEl?.remove();
  styleEl = null;
  document.querySelectorAll('.ps-picker-highlight').forEach((el) => {
    el.classList.remove('ps-picker-highlight');
  });
}

let lastHighlighted: Element | null = null;

function onHover(e: MouseEvent) {
  if (!pickerActive) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el !== lastHighlighted) {
    lastHighlighted?.classList.remove('ps-picker-highlight');
    if (el && el !== document.body && el !== document.documentElement) {
      (el as HTMLElement).classList.add('ps-picker-highlight');
      lastHighlighted = el;
    }
  }
}

function onClick(e: MouseEvent) {
  if (!pickerActive) return;
  e.preventDefault();
  e.stopPropagation();

  const el = e.target as Element;
  if (el === document.body || el === document.documentElement) return;

  const selector = getSelector(el);
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent ?? '').trim().slice(0, 60);

  exitPickerMode();

  const url = window.location.href;
  chrome.runtime.sendMessage(
    { type: 'ADD_PAGE', url, title: document.title, selector },
    (res) => {
      if (res?.ok) {
        showToast(`Watching <${tag}> ${text ? `"${text}"` : ''}`);
      }
    },
  );
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    exitPickerMode();
    showToast('Picker cancelled');
  }
}

function showToast(msg: string) {
  const toast = document.createElement('div');
  toast.className = 'ps-picker-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

/* ── Diff overlay: show changes inline on watched page ── */

function applyDiffOverlay(selector: string | undefined, diffSegments: { type: string; text: string }[]) {
  const meaningful = diffSegments.filter((s) => s.type !== 'unchanged');
  if (meaningful.length === 0) return;

  // If there's a CSS selector, highlight the target element
  if (selector) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) {
      el.style.outline = '3px solid #e53e3e';
      el.style.outlineOffset = '2px';
      el.style.background = '#fff5f5';

      // Show change summary tooltip
      const tip = document.createElement('div');
      tip.id = 'ps-diff-tooltip';
      Object.assign(tip.style, {
        position: 'absolute',
        zIndex: '2147483646',
        background: '#1a1a2e',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '12px',
        fontFamily: 'system-ui, sans-serif',
        lineHeight: '1.4',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
      });
      const added = meaningful.filter((s) => s.type === 'added').map((s) => s.text.trim().slice(0, 80)).join(', ');
      const removed = meaningful.filter((s) => s.type === 'removed').map((s) => s.text.trim().slice(0, 80)).join(', ');
      const parts: string[] = [];
      if (added) parts.push(`+ ${added}`);
      if (removed) parts.push(`− ${removed}`);
      tip.textContent = `PriceSentinel: ${parts.join(' | ')}`;
      document.body.appendChild(tip);

      // Position tooltip near the element
      const rect = el.getBoundingClientRect();
      tip.style.top = `${rect.bottom + window.scrollY + 8}px`;
      tip.style.left = `${rect.left + window.scrollX}px`;
      return;
    }
  }

  // Fallback: show a banner at the top of the page
  const banner = document.createElement('div');
  banner.id = 'ps-diff-banner';
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '2147483647',
    background: '#fef2f2',
    color: '#991b1b',
    padding: '10px 16px',
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    borderBottom: '2px solid #fecaca',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  });
  banner.innerHTML = `<span style="font-weight:600">PriceSentinel</span> Changes detected on this page. <a href="#" style="color:#6366f1;font-weight:500;text-decoration:underline">View in extension popup</a>`;
  banner.querySelector('a')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
  });
  document.body.appendChild(banner);
  document.body.style.marginTop = '42px';
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'ENTER_PICKER') {
        enterPickerMode();
        return true;
      }
      if (msg.type === 'EXIT_PICKER') {
        exitPickerMode();
        return true;
      }
    });

    const url = window.location.href;
    chrome.runtime.sendMessage({ type: 'CHECK_PAGE', url }, (res) => {
      if (res?.watched) {
        // Inject badge
        const badge = document.createElement('div');
        badge.id = 'pricesentinel-badge';
        Object.assign(badge.style, {
          position: 'fixed',
          top: '8px',
          right: '8px',
          zIndex: '2147483647',
          padding: '6px 12px',
          background: '#16a34a',
          color: '#fff',
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'none',
          userSelect: 'none',
        });
        badge.innerHTML = '<span style="margin-right:4px">👁</span>Watched';
        document.body.appendChild(badge);
        setTimeout(() => { badge.style.display = 'flex'; }, 800);
        badge.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_POPUP' }));

        // Fetch changes and apply overlay
        chrome.runtime.sendMessage({ type: 'GET_CHANGES', url }, (resp) => {
          if (resp?.changes?.length > 0) {
            const latest = resp.changes[0];
            if (latest.diff) {
              applyDiffOverlay(res.page?.selector, latest.diff);
            }
          }
        });
      }
    });
  },
});
