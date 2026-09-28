import { BADGE_ATTR } from './badge';

/** Best URL of an <img>, including lazy-loading attributes. */
export function imageUrl(img: HTMLImageElement): string {
  return img.currentSrc || img.src || img.dataset.src || img.getAttribute('data-lazy-src') || img.srcset.split(' ')[0] || '';
}

export function urlPath(url: string): string {
  try {
    return new URL(url, location.href).pathname;
  } catch {
    return url.split(/[?#]/)[0] ?? '';
  }
}

const QTY_RE = /^[×x✕]\s*(\d{1,2})$/i;

/** Parses "×3" / "x 3" / "x3". */
export function parseQty(text: string | null | undefined): number | null {
  const m = QTY_RE.exec((text ?? '').trim());
  return m?.[1] ? parseInt(m[1], 10) : null;
}

/** First leaf descendant (ignoring our badges) whose text is a quantity marker like "×3". */
export function findQtyElement(root: Element): Element | null {
  for (const el of root.querySelectorAll('*')) {
    if ([...el.children].every(isOurs) && parseQty(el.textContent) !== null) return el;
  }
  return null;
}

/** Descendant (or self) whose trimmed text equals `text`, preferring the deepest match. */
export function findTextElement(root: Element, text: string): Element | null {
  const wanted = normalizeText(text);
  if (!wanted) return null;
  let match: Element | null = null;
  for (const el of root.querySelectorAll('*')) {
    if (isOurs(el) || el.closest(`[${BADGE_ATTR}]`)) continue;
    if (normalizeText(ownText(el)) === wanted) match = el;
  }
  return match;
}

function ownText(el: Element): string {
  return [...el.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent)
    .join('');
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isOurs(node: Node | null): boolean {
  return node instanceof Element && node.hasAttribute(BADGE_ATTR);
}
