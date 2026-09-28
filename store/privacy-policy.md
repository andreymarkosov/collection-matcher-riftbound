# Collection Matcher for Riftbound – Privacy Policy

_Last updated: 2026-09-27_

Collection Matcher for Riftbound is a browser extension that shows how many copies of Riftbound cards you own on deck websites.

**What is stored.** The extension stores the following only in your browser (`chrome.storage.local`) on your device:
- the collection files you import
- your settings
- a cached card list
- the riftbound.gg export link, if you add one

**What is sent over the network.**
- Requests to `https://api.riftcodex.com` download the public card list. They contain no personal data.
- If you add a riftbound.gg export link, the extension requests that URL to download your collection CSV. The token in the link is sent only to riftbound.gg (`api.dotgg.gg`), which issued it.

**What is not done.**
- There are no accounts, analytics, tracking or advertising.
- No data is sent to the developer or sold to anyone.
- Page contents on the sites where badges are shown are read locally to find card names. They are never transmitted.

**Your control.** You can remove sources or export a backup at any time in the extension's settings. Uninstalling the extension deletes all of its stored data.

**Contact:** open an issue in the project's repository.
