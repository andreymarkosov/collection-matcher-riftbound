import { render } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { findUnmatched, type Source } from '../core/collection';
import { CSV_FORMATS, parseCollection } from '../core/formats';
import { createBackup, readBackup } from '../shared/backup';
import { sendMessage } from '../shared/messages';
import {
  BUILT_IN_SITES,
  getSettings,
  getSources,
  newSourceId,
  setStored,
  updateSettings,
  updateSources,
  type Settings,
  type StoreShape,
} from '../shared/storage';
import { DOTGG_EXPORT_PREFIX, isDotggExportLink } from '../shared/sync';
import { FileButton, Notice, Section, Stat, SyncButton, Toggle, type StatusMessage } from '../ui/components';
import { formatDate, useCollectionTotals, useSettings, useStored } from '../ui/hooks';

const FORMAT_LABELS: Record<string, string> = Object.fromEntries([
  ...CSV_FORMATS.map((f) => [f.id, f.label]),
  ['text', 'Text list'],
]);

const COLLECTION_FILE_TYPES = '.csv,.txt,text/csv,text/plain';

type SetStatus = (s: StatusMessage) => void;

function App() {
  const settings = useSettings();
  const sources = useStored('sources') ?? [];
  const cardDb = useStored('cardDb');
  const totals = useCollectionTotals();
  const [status, setStatus] = useState<StatusMessage>(null);

  return (
    <main class="page">
      <header class="page-header">
        <img src="../icons/icon-128.png" width="40" height="40" alt="" />
        <div>
          <h1>Collection Matcher for Riftbound</h1>
          <p class="hint">Shows how many copies of each Riftbound card you own, right next to the card on deck sites.</p>
        </div>
      </header>

      <div class="stats">
        <Stat value={totals.copies} label="copies owned" />
        <Stat value={totals.unique} label="different cards" />
        <Stat value={sources.filter((s) => s.enabled).length} label="active sources" />
      </div>

      {status && <Notice kind={status.kind}>{status.text}</Notice>}

      <SourcesSection sources={sources} cardDb={cardDb} setStatus={setStatus} />
      <SyncSection sources={sources} settings={settings} setStatus={setStatus} />
      {settings && <SitesSection settings={settings} setStatus={setStatus} />}
      <CardDbSection cardDb={cardDb} setStatus={setStatus} />
      <BackupSection setStatus={setStatus} />

      <footer class="footer hint">
        Collection Matcher for Riftbound isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
        officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are
        trademarks or registered trademarks of Riot Games, Inc. Card data from{' '}
        <a href="https://riftcodex.com" target="_blank" rel="noreferrer">
          Riftcodex
        </a>
        .
      </footer>
    </main>
  );
}

function patchSource(id: string, patch: Partial<Source>): Promise<Source[]> {
  return updateSources((sources) => sources.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

function SourcesSection(props: { sources: Source[]; cardDb: StoreShape['cardDb'] | undefined; setStatus: SetStatus }) {
  const { sources, cardDb, setStatus } = props;
  const [pasted, setPasted] = useState('');
  const unmatched = useMemo(() => findUnmatched(cardDb, sources.filter((s) => s.enabled)), [cardDb, sources]);

  /** Returns false when nothing could be imported. */
  const importText = async (text: string, label: string, replaceId?: string): Promise<boolean> => {
    const parsed = parseCollection(text);
    if (parsed.rows.length === 0) {
      setStatus({ kind: 'error', text: `No cards found in "${label}". Is it a collection export?` });
      return false;
    }
    const now = new Date().toISOString();
    if (replaceId) {
      await patchSource(replaceId, { rows: parsed.rows, format: parsed.format, updatedAt: now });
    } else {
      await updateSources((current) => [
        ...current,
        { id: newSourceId(), label, kind: 'file', format: parsed.format, enabled: true, updatedAt: now, rows: parsed.rows },
      ]);
    }
    const copies = parsed.rows.reduce((sum, r) => sum + r.normal + r.foil, 0);
    setStatus({
      kind: 'ok',
      text: `Imported ${copies} copies (${parsed.rows.length} rows) as ${FORMAT_LABELS[parsed.format] ?? parsed.format}${
        parsed.skipped ? `, skipped ${parsed.skipped} empty rows` : ''
      }.`,
    });
    return true;
  };

  const importFile = async (file: File, replaceId?: string) => {
    await importText(await file.text(), file.name.replace(/\.(csv|txt)$/i, ''), replaceId);
  };

  return (
    <Section
      title="Collection sources"
      hint="Each import is kept separately, like a binder. Owned counts are the sum of all enabled sources. Supported: riftbound.gg, Piltover Archive, RiftMana, RiftCore, OpenRift and CardNexus CSV exports, any CSV with card id/name + quantity columns, and plain lists like “3 Jinx, Rebel”."
    >
      {sources.length > 0 && (
        <table class="table">
          <thead>
            <tr>
              <th>On</th>
              <th>Name</th>
              <th>Format</th>
              <th class="num">Copies</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    title="Count this source"
                    onChange={(e) => void patchSource(source.id, { enabled: e.currentTarget.checked })}
                  />
                </td>
                <td>
                  <input
                    class="inline-input"
                    value={source.label}
                    onChange={(e) => void patchSource(source.id, { label: e.currentTarget.value.trim() || source.label })}
                  />
                  {source.kind === 'link' && <div class="hint small">riftbound.gg export link</div>}
                  {source.lastError && <div class="error small">{source.lastError}</div>}
                </td>
                <td>{FORMAT_LABELS[source.format] ?? source.format}</td>
                <td class="num">{source.rows.reduce((sum, r) => sum + r.normal + r.foil, 0)}</td>
                <td class="small">{formatDate(source.updatedAt)}</td>
                <td class="actions">
                  {source.kind === 'file' ? (
                    <FileButton
                      label="Replace…"
                      class="small"
                      accept={COLLECTION_FILE_TYPES}
                      onFile={(file) => importFile(file, source.id)}
                    />
                  ) : (
                    <SyncButton class="small" sourceIds={[source.id]} onStatus={setStatus} />
                  )}
                  <button
                    class="small danger"
                    onClick={async () => {
                      await updateSources((current) => current.filter((s) => s.id !== source.id));
                      setStatus({ kind: 'info', text: `Removed “${source.label}”.` });
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div class="row">
        <FileButton label="Import CSV / text file…" class="primary" accept={COLLECTION_FILE_TYPES} onFile={(f) => importFile(f)} />
      </div>

      <details class="details">
        <summary>…or paste a list</summary>
        <textarea
          rows={6}
          placeholder={'3 Jinx, Rebel\n2x Blazing Scorcher (OGN-001)\nOGN-007,6,0,Fury Rune,Origins'}
          value={pasted}
          onInput={(e) => setPasted(e.currentTarget.value)}
        />
        <button
          disabled={!pasted.trim()}
          onClick={async () => {
            // Keep the text when nothing was recognised, so it can be fixed and retried.
            if (await importText(pasted, 'Pasted list')) setPasted('');
          }}
        >
          Import pasted text
        </button>
      </details>

      {unmatched.length > 0 && (
        <details class="details">
          <summary class="error">
            {unmatched.length} {unmatched.length === 1 ? 'row' : 'rows'} didn't match a known card
          </summary>
          <p class="hint small">
            These are still counted under the name or code from the file, but may not line up with cards shown on deck
            sites.
          </p>
          <ul class="unmatched">
            {unmatched.slice(0, 200).map(({ source, row }, i) => (
              <li key={i}>
                {row.code ?? '—'} · {row.name ?? '—'} ×{row.normal + row.foil} <span class="hint">({source})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}

function SyncSection(props: { sources: Source[]; settings: Settings | undefined; setStatus: SetStatus }) {
  const { sources, settings, setStatus } = props;
  const [url, setUrl] = useState('');
  const links = sources.filter((s) => s.kind === 'link');

  const connect = async () => {
    const trimmed = url.trim();
    if (!isDotggExportLink(trimmed)) {
      setStatus({ kind: 'error', text: `That doesn't look like a riftbound.gg export link (${DOTGG_EXPORT_PREFIX}?…&token=…).` });
      return;
    }
    // Connecting the same link twice would count every card twice.
    const existing = (await getSources()).find((s) => s.kind === 'link' && s.url === trimmed);
    const id = existing?.id ?? newSourceId();
    if (!existing) {
      await updateSources((current) => [
        ...current,
        { id, label: 'riftbound.gg (synced)', kind: 'link', format: 'riftboundgg', enabled: true, updatedAt: '', rows: [], url: trimmed },
      ]);
    }
    setUrl('');
    setStatus({ kind: 'info', text: existing ? 'This link is already connected, syncing it again…' : 'Link saved, syncing…' });
    const r = await sendMessage({ type: 'syncLinks', sourceIds: [id] });
    setStatus(r.ok ? { kind: 'ok', text: 'Synced from riftbound.gg.' } : { kind: 'error', text: r.error ?? 'Sync failed' });
  };

  return (
    <Section
      title="Sync with riftbound.gg"
      hint={
        <>
          On riftbound.gg open <b>your profile → Settings → Collection → Permanent export link</b>, click{' '}
          <i>Create link</i> and paste it here. riftbound.gg describes this link as “a URL that always returns your
          current collection as CSV — no login needed, so spreadsheets and other tools can pull it on a schedule”. It is
          stored only in this browser. Treat it like a password: anyone with it can read your collection. You can
          regenerate or revoke it on riftbound.gg at any time.
        </>
      }
    >
      <div class="row">
        <input
          class="grow"
          type="url"
          placeholder={`${DOTGG_EXPORT_PREFIX}?game=riftbound&token=…`}
          value={url}
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
        <button class="primary" disabled={!url.trim()} onClick={() => void connect()}>
          Connect
        </button>
      </div>
      {settings && (
        <div class="row">
          <label>
            Sync automatically every{' '}
            <select
              value={settings.syncIntervalHours}
              onChange={(e) => void updateSettings({ syncIntervalHours: Number(e.currentTarget.value) })}
            >
              {[1, 3, 6, 12, 24].map((h) => (
                <option key={h} value={h}>
                  {h} {h === 1 ? 'hour' : 'hours'}
                </option>
              ))}
            </select>
          </label>
          {links.length > 0 && <SyncButton label="Sync all now" onStatus={setStatus} />}
        </div>
      )}
    </Section>
  );
}

function SitesSection(props: { settings: Settings; setStatus: SetStatus }) {
  const { settings, setStatus } = props;
  const [origin, setOrigin] = useState('');

  const addOrigin = async () => {
    let parsed: URL;
    try {
      parsed = new URL(origin.includes('://') ? origin : `https://${origin}`);
    } catch {
      setStatus({ kind: 'error', text: 'Enter a site address such as riftmana.com' });
      return;
    }
    // Must be called from the click handler so Chrome shows the permission prompt.
    const granted = await chrome.permissions.request({ origins: [`${parsed.origin}/*`] });
    if (!granted) {
      setStatus({ kind: 'error', text: `Permission for ${parsed.origin} was not granted.` });
      return;
    }
    await updateSettings((s) => ({
      genericOrigins: s.genericOrigins.includes(parsed.origin) ? s.genericOrigins : [...s.genericOrigins, parsed.origin],
    }));
    // Re-register even when the origin was already listed (e.g. access was revoked and granted again).
    await sendMessage({ type: 'registerGenericScripts' });
    setOrigin('');
    setStatus({ kind: 'ok', text: `Enabled on ${parsed.origin}. Reload its tabs to see badges.` });
  };

  return (
    <Section title="Sites" hint="Badges are added next to card names; nothing else on the page is changed.">
      {BUILT_IN_SITES.map((site) => (
        <Toggle
          key={site.id}
          checked={settings.sites[site.id]}
          label={site.label}
          onChange={(checked) => void updateSettings((s) => ({ sites: { ...s.sites, [site.id]: checked } }))}
        />
      ))}
      <Toggle
        checked={settings.showOutsideDecks}
        label="Also show owned counts outside deck lists (card galleries, search)"
        onChange={(checked) => void updateSettings({ showOutsideDecks: checked })}
      />

      <h3>Other sites (best effort)</h3>
      <p class="hint">
        Adds owned-count badges to card images whose file name contains a printing code (e.g. riftmana.com). Chrome asks
        for access to each site separately.
      </p>
      {settings.genericOrigins.map((o) => (
        <div class="row" key={o}>
          <code class="grow">{o}</code>
          <button
            class="small danger"
            onClick={async () => {
              await updateSettings((s) => ({ genericOrigins: s.genericOrigins.filter((x) => x !== o) }));
              await chrome.permissions.remove({ origins: [`${o}/*`] });
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <div class="row">
        <input class="grow" placeholder="riftmana.com" value={origin} onInput={(e) => setOrigin(e.currentTarget.value)} />
        <button disabled={!origin.trim()} onClick={() => void addOrigin()}>
          Enable on site
        </button>
      </div>
    </Section>
  );
}

function CardDbSection(props: { cardDb: StoreShape['cardDb'] | undefined; setStatus: SetStatus }) {
  const { cardDb, setStatus } = props;
  return (
    <Section title="Card database" hint="Used to match printings (alt arts, overnumbered, signed, promos) to the same card.">
      <div class="row">
        <span class="grow">
          {cardDb ? `${cardDb.cards.length} printings, updated ${formatDate(cardDb.fetchedAt)}` : 'Loading…'}
        </span>
        <button
          onClick={async () => {
            setStatus({ kind: 'info', text: 'Downloading the card list…' });
            const r = await sendMessage({ type: 'refreshCardDb' });
            setStatus(r.ok ? { kind: 'ok', text: 'Card list refreshed.' } : { kind: 'error', text: r.error ?? 'Refresh failed' });
          }}
        >
          Refresh now
        </button>
      </div>
    </Section>
  );
}

function BackupSection(props: { setStatus: SetStatus }) {
  const { setStatus } = props;

  const exportBackup = async () => {
    const backup = createBackup(await getSettings(), await getSources());
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `collection-matcher-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restoreBackup = async (file: File) => {
    try {
      const { sources, settings } = readBackup(JSON.parse(await file.text()));
      await updateSources(() => sources);
      if (settings) await setStored('settings', settings);
      await sendMessage({ type: 'registerGenericScripts' });
      const extraSites = settings?.genericOrigins.length
        ? ' Extra sites need “Enable on site” again if this is a new browser.'
        : '';
      setStatus({ kind: 'ok', text: `Restored ${sources.length} sources.${extraSites}` });
    } catch (e) {
      setStatus({ kind: 'error', text: `Couldn't restore: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  return (
    <Section title="Backup" hint="Everything is stored locally in this browser. Export a backup to move it to another device.">
      <div class="row">
        <button onClick={() => void exportBackup()}>Export backup (.json)</button>
        <FileButton label="Restore backup…" accept=".json,application/json" onFile={restoreBackup} />
      </div>
    </Section>
  );
}

const root = document.getElementById('app');
if (root) render(<App />, root);
