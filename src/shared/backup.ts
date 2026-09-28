import type { Source } from '../core/collection';
import type { CollectionRow } from '../core/formats';
import { DEFAULT_SETTINGS, type Settings } from './storage';

export const BACKUP_APP_ID = 'collection-matcher';

export interface Backup {
  app: typeof BACKUP_APP_ID;
  version: 1;
  exportedAt: string;
  settings: Settings | undefined;
  sources: Source[];
}

export function createBackup(settings: Settings | undefined, sources: Source[]): Backup {
  return { app: BACKUP_APP_ID, version: 1, exportedAt: new Date().toISOString(), settings, sources };
}

/**
 * Validates a parsed backup file. Malformed sources or rows are dropped (not trusted blindly), so a
 * hand-edited or truncated file can't break the settings page or the index.
 */
export function readBackup(raw: unknown): { sources: Source[]; settings?: Settings } {
  if (!isObject(raw) || raw.app !== BACKUP_APP_ID || !Array.isArray(raw.sources)) {
    throw new Error('Not a Collection Matcher for Riftbound backup file');
  }
  const sources = raw.sources.flatMap((s): Source[] => {
    if (!isObject(s) || typeof s.id !== 'string' || typeof s.label !== 'string' || !Array.isArray(s.rows)) return [];
    const kind = s.kind === 'link' && typeof s.url === 'string' ? 'link' : 'file';
    return [
      {
        id: s.id,
        label: s.label,
        kind,
        format: typeof s.format === 'string' ? s.format : '',
        enabled: s.enabled !== false,
        updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : '',
        rows: s.rows.flatMap(readRow),
        ...(kind === 'link' ? { url: s.url as string } : {}),
      },
    ];
  });
  const settings = isObject(raw.settings) ? readSettings(raw.settings) : undefined;
  return { sources, settings };
}

function readRow(r: unknown): CollectionRow[] {
  if (!isObject(r)) return [];
  const code = typeof r.code === 'string' && r.code ? r.code : undefined;
  const name = typeof r.name === 'string' && r.name ? r.name : undefined;
  const normal = count(r.normal);
  const foil = count(r.foil);
  return (code || name) && normal + foil > 0 ? [{ code, name, normal, foil }] : [];
}

function readSettings(s: Record<string, unknown>): Settings {
  const sites = isObject(s.sites) ? s.sites : {};
  return {
    sites: {
      piltover: sites.piltover !== false,
      riftboundgg: sites.riftboundgg !== false,
      riftdecks: sites.riftdecks !== false,
    },
    genericOrigins: Array.isArray(s.genericOrigins) ? s.genericOrigins.filter((o): o is string => typeof o === 'string') : [],
    syncIntervalHours: count(s.syncIntervalHours) || DEFAULT_SETTINGS.syncIntervalHours,
    showOutsideDecks: s.showOutsideDecks !== false,
  };
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
