import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { BUILT_IN_SITES, updateSettings } from '../shared/storage';
import { Notice, Stat, SyncButton, Toggle, type StatusMessage } from '../ui/components';
import { formatDate, useCollectionTotals, useSettings, useStored } from '../ui/hooks';

function Popup() {
  const settings = useSettings();
  const totals = useCollectionTotals();
  const sources = useStored('sources') ?? [];
  const [tabOrigin, setTabOrigin] = useState<string | null>(null);
  const [message, setMessage] = useState<StatusMessage>(null);

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      try {
        setTabOrigin(tab?.url ? new URL(tab.url).origin : null);
      } catch {
        setTabOrigin(null);
      }
    });
  }, []);

  const host = tabOrigin ? new URL(tabOrigin).hostname.replace(/^www\./, '') : '';
  const builtIn = BUILT_IN_SITES.find((s) => s.hosts.includes(host));
  const generic = !!tabOrigin && !!settings?.genericOrigins.includes(tabOrigin);
  const links = sources.filter((s) => s.kind === 'link');
  const lastSync = links.map((s) => s.updatedAt).sort().at(-1);

  return (
    <main class="popup">
      <header class="page-header">
        <img src="../icons/icon-48.png" width="28" height="28" alt="" />
        <h1>Collection Matcher for Riftbound</h1>
      </header>

      {totals.copies === 0 ? (
        <Notice kind="info">No collection yet. Import a CSV or connect riftbound.gg in the settings.</Notice>
      ) : (
        <div class="stats">
          <Stat value={totals.copies} label="copies" />
          <Stat value={totals.unique} label="cards" />
        </div>
      )}

      {settings && builtIn && (
        <Toggle
          checked={settings.sites[builtIn.id]}
          label={`Show badges on ${builtIn.label}`}
          onChange={(checked) => void updateSettings((s) => ({ sites: { ...s.sites, [builtIn.id]: checked } }))}
        />
      )}
      {settings && !builtIn && generic && <p class="hint">Badges are enabled on this site.</p>}

      {links.length > 0 && (
        <div class="row">
          <span class="grow small">Last sync: {formatDate(lastSync)}</span>
          <SyncButton class="small" onStatus={setMessage} />
        </div>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <button class="primary wide" onClick={() => void chrome.runtime.openOptionsPage()}>
        Manage collection & settings
      </button>
    </main>
  );
}

const root = document.getElementById('app');
if (root) render(<Popup />, root);
