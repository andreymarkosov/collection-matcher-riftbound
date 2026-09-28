import { useEffect, useMemo, useState } from 'preact/hooks';
import { getSettings, getStored, type Settings, type StoreShape } from '../shared/storage';

/** Live value of one chrome.storage.local key. */
export function useStored<K extends keyof StoreShape>(key: K): StoreShape[K] | undefined {
  const [value, setValue] = useState<StoreShape[K] | undefined>(undefined);
  useEffect(() => {
    void getStored(key).then(setValue);
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[key]) setValue(changes[key].newValue as StoreShape[K]);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);
  return value;
}

/** Settings merged with defaults. */
export function useSettings(): Settings | undefined {
  const stored = useStored('settings');
  const [settings, setSettings] = useState<Settings | undefined>(undefined);
  useEffect(() => {
    void getSettings().then(setSettings);
  }, [stored]);
  return settings;
}

/** Copies and distinct cards across all enabled sources. */
export function useCollectionTotals(): { copies: number; unique: number } {
  const index = useStored('lensIndex');
  return useMemo(() => {
    const cards = Object.values(index?.owned ?? {});
    return { unique: cards.length, copies: cards.reduce((sum, c) => sum + c.normal + c.foil, 0) };
  }, [index]);
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return 'never';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'never' : date.toLocaleString();
}
