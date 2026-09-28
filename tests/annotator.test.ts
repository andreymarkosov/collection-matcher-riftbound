// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import type { CardDbData } from '../src/core/cardDb';
import { buildIndex } from '../src/core/collection';
import { startAnnotator } from '../src/content/annotator';
import type { CardHit, SiteAdapter } from '../src/content/types';
import { DEFAULT_SETTINGS, type Settings } from '../src/shared/storage';

const snapshot = JSON.parse(readFileSync('src/data/cards.snapshot.json', 'utf8')) as CardDbData;
const index = buildIndex(snapshot, [
  {
    id: 'a',
    label: 'a',
    kind: 'file',
    format: '',
    enabled: true,
    updatedAt: '',
    rows: [{ code: 'OGN-001', name: 'Blazing Scorcher', normal: 2, foil: 0 }],
  },
]);

function mockChrome(settings: Settings) {
  const store: Record<string, unknown> = { lensIndex: index, settings };
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: { get: async (k: string) => ({ [k]: store[k] }) },
      onChanged: { addListener() {} },
    },
  };
}

/** Deck rows: `<div class="row"><span class="name">…</span></div>`; the aside card is not part of the deck. */
const adapter: SiteAdapter = {
  id: 'test',
  isDeckPage: () => true,
  scan: (doc) =>
    [...doc.querySelectorAll('.name')].map(
      (el): CardHit => ({
        anchor: el,
        placement: 'after',
        code: el.getAttribute('data-code'),
        name: el.textContent,
        deckQty: el.closest('aside') ? undefined : 3,
      }),
    ),
};

const badgeTexts = () => [...document.querySelectorAll('[data-rbcl-badge]')].map((b) => b.getAttribute('title')?.split('\n')[1]);

describe('annotator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 16) as unknown as number;
    // A fresh <body> per test: annotators from earlier tests keep observing the old one.
    document.documentElement.replaceChild(document.createElement('body'), document.body);
    document.body.innerHTML = `
      <main><div class="row"><span class="name" data-code="OGN-001">Blazing Scorcher</span></div></main>
      <aside><div class="row"><span class="name" data-code="OGN-001">Blazing Scorcher</span></div></aside>`;
  });
  afterEach(() => vi.useRealTimers());

  it('renders even while the page mutates non-stop', async () => {
    mockChrome(DEFAULT_SETTINGS);
    startAnnotator(adapter, () => true);
    const ticker = setInterval(() => document.body.append(document.createTextNode('.')), 100);
    await vi.advanceTimersByTimeAsync(2500);
    clearInterval(ticker);
    expect(document.querySelectorAll('[data-rbcl-badge]').length).toBe(2);
  });

  it('shows owned/needed and hides non-deck cards when "outside deck lists" is off', async () => {
    mockChrome({ ...DEFAULT_SETTINGS, showOutsideDecks: false });
    startAnnotator(adapter, () => true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(badgeTexts()).toEqual(['Needed in this deck: 3']);
    expect(document.querySelector('main [data-rbcl-badge]')).not.toBeNull();
    expect(document.querySelector('aside [data-rbcl-badge]')).toBeNull();
  });

  it('puts a badge back when the site re-renders it away', async () => {
    mockChrome(DEFAULT_SETTINGS);
    startAnnotator(adapter, () => true);
    await vi.advanceTimersByTimeAsync(1000);
    document.querySelector('main [data-rbcl-badge]')?.remove();
    await vi.advanceTimersByTimeAsync(500);
    expect(document.querySelector('main [data-rbcl-badge]')).not.toBeNull();
  });
});
