import { BADGE_ATTR } from './badge';

export type FloatPosition = 'top-center' | 'end';

interface Item {
  anchor: Element;
  position: FloatPosition;
}

/**
 * Badges for sites whose framework strips foreign nodes from its components (riftbound.gg re-renders its
 * deck tiles constantly). They live in one layer appended to <html>, outside any framework root, and are
 * positioned over their anchors. The layer never receives pointer events, so the site's hovers still work.
 */
export class FloatLayer {
  private root: HTMLElement | null = null;
  private readonly items = new Map<HTMLElement, Item>();
  private frame = 0;

  constructor() {
    const schedule = () => this.schedule();
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    // Late image loads shift layout without any DOM mutation.
    document.addEventListener('load', schedule, { capture: true, passive: true });
  }

  add(host: HTMLElement, anchor: Element, position: FloatPosition): void {
    host.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;line-height:0;will-change:transform;';
    this.ensureRoot().append(host);
    this.items.set(host, { anchor, position });
    this.schedule();
  }

  has(host: HTMLElement): boolean {
    return host.isConnected && this.items.has(host);
  }

  schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.position();
    });
  }

  private position(): void {
    for (const [host, { anchor, position }] of this.items) {
      if (!host.isConnected) {
        this.items.delete(host);
        continue;
      }
      const rect = anchor.getBoundingClientRect();
      if (!anchor.isConnected || (rect.width === 0 && rect.height === 0) || isCovered(anchor, rect, position)) {
        host.style.display = 'none';
        continue;
      }
      host.style.display = '';
      const x = position === 'end' ? rect.right + 4 : rect.left + rect.width / 2;
      const y = position === 'end' ? rect.top + rect.height / 2 : rect.top + 6;
      const shift = position === 'end' ? 'translateY(-50%)' : 'translateX(-50%)';
      host.style.transform = `translate(${x + window.scrollX}px, ${y + window.scrollY}px) ${shift}`;
    }
  }

  private ensureRoot(): HTMLElement {
    if (this.root?.isConnected) return this.root;
    const root = document.createElement('div');
    root.setAttribute(BADGE_ATTR, 'layer');
    root.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none;';
    document.documentElement.append(root);
    this.root = root;
    return root;
  }
}

/**
 * True when the badge's spot on the anchor is scrolled out of view or hidden behind something else
 * (e.g. a sticky site header). Our layer has pointer-events:none, so elementFromPoint looks through it.
 */
function isCovered(anchor: Element, rect: DOMRect, position: FloatPosition): boolean {
  const x = position === 'end' ? rect.right - 2 : rect.left + rect.width / 2;
  const y = position === 'end' ? rect.top + rect.height / 2 : rect.top + 12;
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true;
  const top = document.elementFromPoint(x, y);
  return !top || !(anchor.contains(top) || top.contains(anchor));
}
