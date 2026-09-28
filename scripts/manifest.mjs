/** Manifest V3 definition; the version comes from package.json. */
export function createManifest(version) {
  return {
    manifest_version: 3,
    name: 'Collection Matcher for Riftbound',
    short_name: 'RB Matcher',
    version,
    description:
      'See how many copies of each Riftbound card you own right next to card names on Piltover Archive, riftbound.gg and riftdecks.com.',
    icons: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' },
    action: { default_popup: 'popup/popup.html', default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } },
    options_page: 'options/options.html',
    background: { service_worker: 'background.js', type: 'module' },
    permissions: ['storage', 'unlimitedStorage', 'alarms', 'scripting'],
    host_permissions: [
      'https://piltoverarchive.com/*',
      'https://riftbound.gg/*',
      'https://riftdecks.com/*',
      'https://www.riftdecks.com/*',
      'https://api.riftcodex.com/*',
      'https://api.dotgg.gg/*',
    ],
    optional_host_permissions: ['https://*/*'],
    content_scripts: [
      {
        matches: ['https://piltoverarchive.com/*', 'https://riftbound.gg/*', 'https://riftdecks.com/*', 'https://www.riftdecks.com/*'],
        js: ['content/main.js'],
        run_at: 'document_idle',
      },
    ],
  };
}
