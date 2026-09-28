import { createBackup, readBackup } from '../src/shared/backup';
import { DEFAULT_SETTINGS } from '../src/shared/storage';

describe('readBackup', () => {
  it('round-trips a backup', () => {
    const source = { id: 'a', label: 'A', kind: 'file' as const, format: 'riftboundgg', enabled: true, updatedAt: 't', rows: [{ code: 'OGN-001', name: 'Blazing Scorcher', normal: 2, foil: 1 }] };
    const restored = readBackup(JSON.parse(JSON.stringify(createBackup(DEFAULT_SETTINGS, [source]))));
    expect(restored.sources).toEqual([source]);
    expect(restored.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('drops malformed sources and rows instead of breaking the page', () => {
    const restored = readBackup({
      app: 'collection-matcher',
      sources: [
        { id: 'no-rows', label: 'x' },
        null,
        { id: 'ok', label: 'ok', rows: [{ code: 'OGN-001', normal: '3' }, { name: 'Cleave', normal: 2, foil: -1 }, 'junk'] },
      ],
      settings: { sites: { piltover: false }, genericOrigins: ['https://riftmana.com', 5], syncIntervalHours: 'x' },
    });
    expect(restored.sources).toHaveLength(1);
    expect(restored.sources[0]?.rows).toEqual([{ code: undefined, name: 'Cleave', normal: 2, foil: 0 }]);
    expect(restored.settings).toMatchObject({
      sites: { piltover: false, riftboundgg: true, riftdecks: true },
      genericOrigins: ['https://riftmana.com'],
      syncIntervalHours: DEFAULT_SETTINGS.syncIntervalHours,
    });
  });

  it('rejects other files', () => {
    expect(() => readBackup({ sources: [] })).toThrow('Not a Collection Matcher for Riftbound backup file');
  });
});
