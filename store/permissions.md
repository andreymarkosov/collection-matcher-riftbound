# Privacy tab answers

**Single purpose:** Show how many copies of each Riftbound card the user owns, next to card names on Riftbound deck websites.

| Permission | Justification |
|---|---|
| `storage`, `unlimitedStorage` | Stores the user's imported collection, settings and a cached card list locally. A large collection plus the card list can exceed the default quota. |
| `alarms` | Periodically re-downloads the user's own riftbound.gg export link (if configured) and refreshes the card list weekly. |
| `scripting` | Registers the content script only on extra sites the user explicitly enables in settings (optional host permissions). |
| Host `piltoverarchive.com`, `riftbound.gg`, `riftdecks.com` | Content script that adds owned-count badges next to card names on these deck sites. |
| Host `api.riftcodex.com` | Downloads the public Riftbound card list, used to match printings (alt art, promos…) to the same card. |
| Host `api.dotgg.gg` | Fetches the user's own riftbound.gg "Permanent export link" (CSV) when they choose to sync. |
| Optional host `https://*/*` | Requested one site at a time, only when the user clicks "Enable on site" in settings, to show badges on other Riftbound sites. |

**Remote code:** No. All code ships in the package. Only JSON/CSV data is fetched.

**Data usage:**
- The extension does not collect or transmit user data to the developer or any third party.
- The collection and the optional export link are stored only in `chrome.storage.local`.
- Certify: no data is sold, none is used for unrelated purposes, and none is used for creditworthiness.
