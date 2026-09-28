# Collection Matcher for Riftbound

A Chrome extension (Manifest V3) that shows **how many copies of each Riftbound card you own** next to card names on
deck sites. It works like [MTG Collection Lens](https://fccmtgdev.github.io/collectionlens/), but for Riftbound.

- **Deck pages** show `owned/needed`: green when you own enough copies, amber when you own some, red when you own none.
- **Other pages** (galleries, search) show `×owned`.
- Hovering a badge shows the breakdown per printing (normal/foil) and per source.
- Owned copies are **summed across printings**: alt art, overnumbered, signed and promo versions all count toward the same card.
- The badge is the only thing added to the page. Hover previews, clicks and layout are left alone.
- **Serverless.** Everything is stored in `chrome.storage.local`. The only network requests go to the public
  [Riftcodex](https://riftcodex.com) card API and to your own riftbound.gg export link, if you add one.

## Supported sites

| Site | Where badges appear |
|---|---|
| [piltoverarchive.com](https://piltoverarchive.com) | Deck gallery view (on the first tile of each card), list view (after the name), card galleries |
| [riftbound.gg](https://riftbound.gg) | Deck tiles (after the name), card images |
| [riftdecks.com](https://riftdecks.com) | Text decklist (after the name), visual decklist |
| Any other site you enable in settings | Card images whose file name or alt text contains a printing code (e.g. riftmana.com) |

## Getting your collection in

### CSV or text import

Import an export file from any of these trackers. The format is detected automatically.

| Tracker | How it's recognised |
|---|---|
| riftbound.gg | `CardId,Normal,Foil,Name,Set` |
| Piltover Archive | `Variant Number,Card Name,…,Foil,Quantity,…` |
| RiftMana | `Normal Qty,Foil Qty,Card Name,Card ID,…` |
| RiftCore | `RIFTCORE COLLECTION EXPORT` preamble, then `Card ID,…,Standard Qty,Foil Qty` |
| OpenRift | `Card ID,Card Name,…,Finish,Art Variant,…,Quantity` |
| CardNexus | `totalQtyOwned,name,…,riotId,…` |

It also accepts:
- any other CSV with a card id or name column plus quantity columns (the same aliases riftbound.gg's importer uses)
- plain lists such as `3 Jinx, Rebel` or `2x Blazing Scorcher (OGN-001)`

Each import is a separate **source**, like a binder. You can rename, replace, disable or remove each one.

Printing codes are normalised across trackers, so all of these are understood:
- `OGN-066a/298` and `OGN-007A` (alt art)
- `OGN-301*`, `SFD-227-STAR` and `OGN-299S` (signed)
- `UNL-107-P` and `OGN-263-Worlds` (promos)
- `OGN-001-Foil`

### Sync with riftbound.gg (no server, documented link)

riftbound.gg gives each user a **Permanent export link**: *"A URL that always returns your current collection as CSV — no
login needed, so spreadsheets and other tools can pull it on a schedule."* To use it:

1. On riftbound.gg, open **your profile → Settings → Collection → Permanent export link** and click **Create link**.
2. Paste the link into the extension's settings under **Sync with riftbound.gg**.

The extension fetches the link every few hours (you choose how often), or whenever you click **Sync now**. Anyone with
the link can read your collection, so treat it like a password. You can regenerate or revoke it on riftbound.gg.

No other site offers an official way for third-party tools to read a collection. Piltover Archive's collection API is
only for partners, so for those sites use CSV export and import.

## Development

```bash
npm install
npm test            # unit tests (parsers, code normalisation, matching) against real exports in fixtures/
npm run typecheck
npm run build       # production build → dist/
npm run build:dev   # dev build → dist/ (adds the automation bridge, see below)
npm run watch       # dev build + rebuild on change
npm run card-db     # refresh the bundled card snapshot (src/data/cards.snapshot.json) from Riftcodex
npm run zip         # production build + release/collection-matcher-<version>.zip (built in build/release, so a loaded dev build in dist/ is untouched)
```

To try it, load `dist/` via `chrome://extensions` → Developer mode → **Load unpacked**.

**Dev bridge.** Dev builds only. A page on a supported site can call
`window.postMessage({ rbclDev: 'reload' | 'seed' | 'state' }, '*')`:
- `reload` reloads the extension after a rebuild
- `seed` imports `fixtures/riftboundgg-collection.csv`
- `state` returns a summary

Production builds strip the bridge completely.

### Layout

```
src/core/        pure logic: CSV parser, printing-code + name normalisation, format detectors, card DB, index
src/background/  service worker: card DB refresh, export-link sync (chrome.alarms), generic-site registration
src/content/     annotator (MutationObserver + Shadow-DOM badges) and one adapter per site
src/options/     settings page (Preact)      src/popup/  toolbar popup (Preact)
fixtures/        real riftbound.gg + Piltover Archive exports and synthetic files for other formats
store/           Chrome Web Store listing, permission justifications, privacy policy
```

## Publishing

See [store/PUBLISHING.md](store/PUBLISHING.md).

## Legal

Collection Matcher for Riftbound isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are
trademarks or registered trademarks of Riot Games, Inc. Card data comes from [Riftcodex](https://riftcodex.com).

MIT licensed.
