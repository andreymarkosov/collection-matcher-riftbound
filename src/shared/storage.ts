import type { CardDbData } from '../core/cardDb';
import type { LensIndex, Source } from '../core/collection';

export type SiteId = 'piltover' | 'riftboundgg' | 'riftdecks';

export const BUILT_IN_SITES: { id: SiteId; label: string; hosts: string[] }[] = [
  { id: 'piltover', label: 'Piltover Archive', hosts: ['piltoverarchive.com'] },
  { id: 'riftboundgg', label: 'riftbound.gg', hosts: ['riftbound.gg'] },
  { id: 'riftdecks', label: 'riftdecks.com', hosts: ['riftdecks.com'] },
];

export interface Settings {
  sites: Record<SiteId, boolean>;
  /** Extra origins (e.g. "https://riftmana.com") where the generic adapter runs. */
  genericOrigins: string[];
  syncIntervalHours: number;
  /** Show "×N" badges outside deck lists too (card galleries, search results). */
  showOutsideDecks: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sites: { piltover: true, riftboundgg: true, riftdecks: true },
  genericOrigins: [],
  syncIntervalHours: 6,
  showOutsideDecks: true,
};

export interface StoreShape {
  settings: Settings;
  sources: Source[];
  cardDb: CardDbData;
  lensIndex: LensIndex;
}

export async function getStored<K extends keyof StoreShape>(key: K): Promise<StoreShape[K] | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as StoreShape[K] | undefined;
}

export async function setStored<K extends keyof StoreShape>(key: K, value: StoreShape[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<Settings> {
  const stored = await getStored('settings');
  return { ...DEFAULT_SETTINGS, ...stored, sites: { ...DEFAULT_SETTINGS.sites, ...stored?.sites } };
}

let writeQueue: Promise<unknown> = Promise.resolve();

/** Runs read-modify-write updates one after another, so quick consecutive edits can't overwrite each other. */
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

/** Patches the latest stored settings (not a possibly stale copy held by the UI). */
export function updateSettings(patch: Partial<Settings> | ((current: Settings) => Partial<Settings>)): Promise<Settings> {
  return serialized(async () => {
    const current = await getSettings();
    const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
    await setStored('settings', next);
    return next;
  });
}

export async function getSources(): Promise<Source[]> {
  return (await getStored('sources')) ?? [];
}

/** Replaces the source list with `update(latest)`. */
export function updateSources(update: (current: Source[]) => Source[]): Promise<Source[]> {
  return serialized(async () => {
    const next = update(await getSources());
    await setStored('sources', next);
    return next;
  });
}

export function newSourceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
