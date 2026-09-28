import { BADGE_ATTR, type Badge } from './badge';

const STYLE = `
  :host { all: initial; }
  .tip {
    position: fixed; z-index: 2147483001; max-width: 320px;
    padding: 6px 8px; border-radius: 6px; white-space: pre-line;
    font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #f1f3f6; background: rgba(20, 26, 36, .96);
    box-shadow: 0 4px 16px rgba(0,0,0,.35); pointer-events: none;
  }
`;

/**
 * Tooltip for click-through badges (over card images). It listens for pointer moves on the document
 * (passive, never on site elements, never cancelling anything) and hit-tests the badges' rectangles,
 * so the site's own hover behaviour is untouched.
 */
export class HoverTip {
  private host: HTMLElement | null = null;
  private tip: HTMLElement | null = null;
  private frame = 0;
  private x = 0;
  private y = 0;

  constructor(private readonly badges: () => Iterable<Badge>) {
    document.addEventListener(
      'pointermove',
      (e) => {
        this.x = e.clientX;
        this.y = e.clientY;
        if (!this.frame) this.frame = requestAnimationFrame(() => this.update());
      },
      { passive: true, capture: true },
    );
    window.addEventListener('scroll', () => this.hide(), { passive: true, capture: true });
  }

  private update(): void {
    this.frame = 0;
    for (const badge of this.badges()) {
      if (badge.interactive || !badge.host.isConnected || badge.host.style.display === 'none') continue;
      const r = badge.bounds();
      if (this.x >= r.left && this.x <= r.right && this.y >= r.top && this.y <= r.bottom) {
        this.show(badge.title, r);
        return;
      }
    }
    this.hide();
  }

  private show(text: string, anchor: DOMRect): void {
    const tip = this.ensureTip();
    tip.textContent = text;
    tip.style.display = 'block';
    const width = tip.offsetWidth;
    const left = Math.min(Math.max(4, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - 4);
    const below = anchor.bottom + 6;
    const top = below + tip.offsetHeight > window.innerHeight ? anchor.top - tip.offsetHeight - 6 : below;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  private hide(): void {
    if (this.tip) this.tip.style.display = 'none';
  }

  private ensureTip(): HTMLElement {
    if (this.host?.isConnected && this.tip) return this.tip;
    const host = document.createElement('span');
    host.setAttribute(BADGE_ATTR, 'tip');
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    const tip = document.createElement('div');
    tip.className = 'tip';
    shadow.append(style, tip);
    document.documentElement.append(host);
    this.host = host;
    this.tip = tip;
    return tip;
  }
}
