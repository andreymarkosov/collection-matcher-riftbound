// @vitest-environment jsdom
import { piltoverAdapter } from '../src/content/sites/piltover';
import { riftboundggAdapter } from '../src/content/sites/riftboundgg';
import { riftdecksAdapter } from '../src/content/sites/riftdecks';
import { genericAdapter } from '../src/content/sites/generic';

// Markup trimmed down from the live sites (September 2026).

describe('riftdecks adapter', () => {
  it('reads code and quantity from decklist rows', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr class="card-list-item" data-quantity="3" data-image-src="/img/cards/riftbound/SFD/sfd-036-221_full.png">
          <td>3</td><td><a href="/cards/details-lonely-poro">Lonely Poro</a></td>
        </tr>
      </tbody></table>
      <div class="card-image"><img src="https://riftdecks.com/img/cards/riftbound/OGN/ogn-126-298_full.png" alt="Body Rune"></div>`;
    const hits = riftdecksAdapter.scan(document);
    expect(riftdecksAdapter.isDeckPage(document)).toBe(true);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ placement: 'after', code: '/img/cards/riftbound/SFD/sfd-036-221_full.png', name: 'Lonely Poro', deckQty: 3 });
    expect(hits[1]).toMatchObject({ placement: 'overlay', name: 'Body Rune' });
    expect(hits[1]?.deckQty).toBeUndefined();
  });
});

describe('riftbound.gg adapter', () => {
  it('anchors on the printed card code and reads the xN chip', () => {
    window.history.pushState({}, '', '/decks/reksai-top-16');
    document.body.innerHTML = `
      <div class="tile">
        <div class="img"><div></div></div>
        <div class="info">
          <div class="row"><div class="name">Rek'Sai - Void Burrower</div><div class="qty">x<!-- -->1</div></div>
          <div class="row2"><div class="code">SFD-187<!-- --> ·<img alt="Rare"></div><div>0.23</div></div>
        </div>
      </div>`;
    const hits = riftboundggAdapter.scan(document);
    expect(riftboundggAdapter.isDeckPage(document)).toBe(true);
    expect(hits).toEqual([
      expect.objectContaining({ code: 'SFD-187', name: "Rek'Sai - Void Burrower", deckQty: 1, placement: 'float-end' }),
    ]);
  });
});

describe('riftbound.gg adapter: false positives', () => {
  it('ignores hyphenated words that look like codes', () => {
    window.history.pushState({}, '', '/decks/some-deck');
    document.body.innerHTML = `<div><div><div><div class="t">Top-16</div><div class="q">x2</div></div><div><div>Co-op</div></div></div></div>`;
    expect(riftboundggAdapter.scan(document)).toEqual([]);
  });
});

describe('generic adapter', () => {
  it('gives sibling card images their own anchors and accepts rune codes', () => {
    document.body.innerHTML = `<div class="grid">
      <img src="https://example.com/cards/OGN-001.webp" alt="Blazing Scorcher">
      <img src="https://example.com/cards/VEN-R01.webp" alt="Fury Rune">
    </div>`;
    for (const img of document.querySelectorAll('img')) {
      img.getBoundingClientRect = () => ({ width: 200, height: 280 }) as DOMRect;
    }
    const hits = genericAdapter.scan(document);
    expect(hits.map((h) => [h.anchor.tagName, h.placement, h.code])).toEqual([
      ['IMG', 'float', '/cards/OGN-001.webp'],
      ['IMG', 'float', '/cards/VEN-R01.webp'],
    ]);
  });
});

describe('Piltover Archive adapter', () => {
  it('counts one gallery tile per copy and "×N" on runes, only inside deck sections', () => {
    window.history.pushState({}, '', '/decks/view/abc');
    // Gallery images sit in an aspect-ratio box; jsdom reports width 0 like a not-yet-loaded lazy image.
    const tile = (code: string, name: string, extra = '') =>
      `<div class="tile"><div class="relative aspect-[63/88]"><img src="https://cdn.piltoverarchive.com/cards/${code}.webp" alt="${name}">${extra}</div></div>`;
    document.body.innerHTML = `
      <main>
        <section><div><h3>Runes</h3></div><div class="grid">${tile('OGN-166', 'Chaos Rune', '<div>×9</div>')}</div></section>
        <section><div><h3>Main Deck</h3></div><div class="grid">
          ${tile('OGN-204', 'Seal of Discord')}${tile('OGN-204', 'Seal of Discord')}${tile('OGN-204', 'Seal of Discord')}
        </div></section>
        <aside>${tile('OGN-001', 'Blazing Scorcher')}</aside>
      </main>`;
    const hits = piltoverAdapter.scan(document);
    expect(piltoverAdapter.isDeckPage(document)).toBe(true);
    expect(hits.map((h) => [h.name, h.deckQty])).toEqual([
      ['Chaos Rune', 9],
      ['Seal of Discord', 1],
      ['Seal of Discord', 1],
      ['Seal of Discord', 1],
      ['Blazing Scorcher', undefined],
    ]);
    // Outside the deck list (e.g. the card library) every printing gets its own badge.
    expect(hits[4]?.group).toBeUndefined();
    // Same grid → same group, so the annotator shows one badge for the three Seal of Discord tiles.
    const groups = hits.slice(1, 4).map((h) => h.group);
    expect(groups[0]).toBeInstanceOf(Element);
    expect(new Set(groups).size).toBe(1);
    expect(hits[0]?.group).not.toBe(groups[0]);
  });

  it('puts list-view badges after the name', () => {
    document.body.innerHTML = `
      <section><div><h3>Main Deck</h3></div><div>
        <div class="row"><div>×3</div><div class="thumb"><img src="https://cdn.piltoverarchive.com/cards/OGN-204.webp" alt="Seal of Discord"></div>
          <div><span class="name">Seal of Discord</span></div></div>
      </div></section>`;
    const [hit] = piltoverAdapter.scan(document);
    expect(hit).toMatchObject({ placement: 'after', deckQty: 3, group: undefined });
    expect(hit?.anchor.className).toBe('name');
  });
});
