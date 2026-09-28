import { buildIndex } from '../core/collection';
import type { CardDbData } from '../core/cardDb';
import snapshot from '../data/cards.snapshot.json';
import { parseCollection } from '../core/formats';
import type { Message, MessageResult } from '../shared/messages';
import { fetchRiftcodexCards } from '../shared/riftcodex';
import { getSettings, getSources, getStored, newSourceId, setStored, updateSources, type Settings } from '../shared/storage';
import { syncLinkSource } from '../shared/sync';

const SYNC_ALARM = 'sync-links';
const CARD_DB_ALARM = 'refresh-card-db';
const CARD_DB_REFRESH_DAYS = 7;
const GENERIC_SCRIPT_ID = 'generic-sites';
/** DotGG asks API clients to stay under 1 request per second. */
const LINK_SYNC_SPACING_MS = 1100;

chrome.runtime.onInstalled.addListener(() => void initialize());
chrome.runtime.onStartup.addListener(() => void initialize());

async function initialize(): Promise<void> {
  const cardDb = await getStored('cardDb');
  if (!cardDb || cardDb.fetchedAt < (snapshot as CardDbData).fetchedAt) {
    await setStored('cardDb', snapshot as CardDbData);
  }
  const settings = await getSettings();
  await setStored('settings', settings);
  await rebuildIndex();
  await scheduleAlarms(settings);
  await registerGenericScripts();
  if (isStale(await getStored('cardDb'))) void refreshCardDb();
}

async function scheduleAlarms(settings: Settings): Promise<void> {
  await chrome.alarms.create(SYNC_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: Math.max(1, settings.syncIntervalHours) * 60,
  });
  await chrome.alarms.create(CARD_DB_ALARM, { periodInMinutes: 24 * 60 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) void syncLinks();
  if (alarm.name === CARD_DB_ALARM) {
    void getStored('cardDb').then(async (db) => {
      if (isStale(db)) await refreshCardDb();
    });
  }
});

function isStale(db: CardDbData | undefined): boolean {
  if (!db) return true;
  return Date.now() - Date.parse(db.fetchedAt) > CARD_DB_REFRESH_DAYS * 24 * 3600 * 1000;
}

/** Downloads the card list; on any failure the cached one is kept and the reason returned. */
async function refreshCardDb(): Promise<MessageResult> {
  try {
    const fresh = await fetchRiftcodexCards();
    if (fresh.cards.length === 0) throw new Error('Riftcodex returned no cards');
    await setStored('cardDb', fresh);
    return { ok: true };
  } catch (e) {
    console.warn('[Collection Matcher] Card list refresh failed, keeping the cached one.', e);
    return { ok: false, error: `Couldn't download the card list: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function syncLinks(sourceIds?: string[]): Promise<MessageResult> {
  const sources = await getSources();
  const targets = sources.filter((s) => s.kind === 'link' && s.url && (!sourceIds || sourceIds.includes(s.id)));
  const errors: string[] = [];
  for (const [i, target] of targets.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, LINK_SYNC_SPACING_MS));
    const synced = await syncLinkSource(target);
    if (synced.lastError) errors.push(`${synced.label}: ${synced.lastError}`);
    // Apply to the latest list so a concurrent edit in the options page isn't lost.
    await updateSources((latest) =>
      latest.map((s) => (s.id === synced.id ? { ...synced, label: s.label, enabled: s.enabled } : s)),
    );
  }
  return errors.length ? { ok: false, error: errors.join('\n') } : { ok: true };
}

let rebuildTimer: ReturnType<typeof setTimeout> | undefined;

async function rebuildIndex(): Promise<void> {
  const [cardDb, sources] = await Promise.all([getStored('cardDb'), getSources()]);
  await setStored('lensIndex', buildIndex(cardDb, sources));
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.sources || changes.cardDb) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => void rebuildIndex(), 200);
  }
  const settingsChange = changes.settings;
  if (settingsChange) {
    const before = settingsChange.oldValue as Settings | undefined;
    const after = settingsChange.newValue as Settings;
    if (before?.syncIntervalHours !== after.syncIntervalHours) void scheduleAlarms(after);
    if (JSON.stringify(before?.genericOrigins) !== JSON.stringify(after.genericOrigins)) {
      void registerGenericScripts();
    }
  }
});

let registration: Promise<void> = Promise.resolve();

/**
 * The generic adapter only runs on origins the user explicitly granted from the options page.
 * Calls are chained: permission and settings events often fire together, and overlapping
 * unregister/register calls fail with "nonexistent/duplicate script ID".
 */
function registerGenericScripts(): Promise<void> {
  registration = registration.then(doRegisterGenericScripts).catch((e: unknown) => {
    console.warn('[Collection Matcher] Registering scripts for extra sites failed.', e);
  });
  return registration;
}

async function doRegisterGenericScripts(): Promise<void> {
  const settings = await getSettings();
  const granted: string[] = [];
  for (const origin of settings.genericOrigins) {
    const pattern = `${origin}/*`;
    if (await chrome.permissions.contains({ origins: [pattern] })) granted.push(pattern);
  }
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [GENERIC_SCRIPT_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [GENERIC_SCRIPT_ID] });
  if (!granted.length) return;
  await chrome.scripting.registerContentScripts([
    { id: GENERIC_SCRIPT_ID, matches: granted, js: ['content/generic.js'], runAt: 'document_idle', persistAcrossSessions: true },
  ]);
}

chrome.permissions.onAdded.addListener(() => void registerGenericScripts());
chrome.permissions.onRemoved.addListener(() => void registerGenericScripts());

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse: (r: MessageResult) => void) => {
  const handle = async (): Promise<MessageResult> => {
    switch (message.type) {
      case 'syncLinks':
        return syncLinks(message.sourceIds);
      case 'refreshCardDb':
        return refreshCardDb();
      case 'registerGenericScripts':
        await registerGenericScripts();
        return { ok: true };
      case 'dev':
        return __DEV__ ? handleDevAction(message.action) : { ok: false, error: 'Not a dev build' };
    }
  };
  handle()
    .then(sendResponse)
    .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  return true;
});

/** Dev builds only (see src/content/dev-bridge.ts). */
async function handleDevAction(action: string): Promise<MessageResult> {
  if (action === 'reload') {
    setTimeout(() => chrome.runtime.reload(), 100);
    return { ok: true };
  }
  if (action === 'seed') {
    const text = await (await fetch(chrome.runtime.getURL('dev/fixture.csv'))).text();
    const parsed = parseCollection(text);
    await updateSources(() => [
      { id: newSourceId(), label: 'fixture', kind: 'file', format: parsed.format, enabled: true, updatedAt: new Date().toISOString(), rows: parsed.rows },
    ]);
    await rebuildIndex();
    return { ok: true };
  }
  if (action === 'state') {
    const index = await getStored('lensIndex');
    const sources = await getSources();
    return {
      ok: true,
      data: { id: chrome.runtime.id, sources: sources.map((s) => [s.label, s.rows.length]), owned: Object.keys(index?.owned ?? {}).length },
    };
  }
  return { ok: false, error: `Unknown dev action ${action}` };
}
