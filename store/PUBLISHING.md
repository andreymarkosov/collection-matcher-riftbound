# Publishing to the Chrome Web Store

## One-time setup (done by the account owner)

1. **Register as a developer.** Go to https://chrome.google.com/webstore/devconsole. You need a Google account with 2-Step Verification, and there is a one-time **US$5** registration fee.
2. **Trader declaration (EU DSA).** Choose **non-trader** for a free hobby project. If you choose "trader", your contact details are shown publicly.
3. **Host the privacy policy.** Put `store/privacy-policy.md` online, for example with GitHub Pages or a GitHub-rendered file URL. The listing needs a public URL.

## Each release

1. Bump `version` in `package.json`. Every upload needs a higher version.
2. Run `npm test && npm run typecheck && npm run zip`. This produces `release/collection-matcher-<version>.zip`.
3. In the Developer Dashboard, go to **Package → Upload new package**.
4. Fill in or keep:
   - the **Store listing**, from `store/listing.md`
   - screenshots
   - the **Privacy** tab, from `store/permissions.md`
   - the privacy policy URL
5. Click **Submit for review**. Review usually takes a few days. Broad host permissions trigger a slower in-depth review, which is why `https://*/*` is optional and requested one site at a time.

## Optional: publish from CI

`chrome-webstore-upload-cli` can upload and publish with the Chrome Web Store API. It needs an OAuth client ID, client secret and refresh token, stored as repository secrets. A GitHub Actions job on a `v*` tag would run `npm ci && npm run zip` and then upload the zip.

## Other stores

- **Microsoft Edge Add-ons:** free, and accepts the same zip.
- **Firefox:** would need `browser_specific_settings` and a background-script fallback. Not done yet.

## IP notes

- Riftbound, its card names and its card art belong to Riot Games.
- Keep the extension free.
- Include the Riot fan-content disclaimer (already in the listing and the settings page).
- Don't use Riot logos or card art in the icon or the promo tiles.
