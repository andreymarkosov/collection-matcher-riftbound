import { readFileSync } from 'node:fs';
import { CardDb, type CardDbData } from '../src/core/cardDb';
import { normalizePrinting, parseCardCode } from '../src/core/cardId';
import { buildIndex, findUnmatched, lookupKey, type Source } from '../src/core/collection';
import { parseCsv } from '../src/core/csv';
import { parseCollection } from '../src/core/formats';
import { nameKey } from '../src/core/names';

const snapshot = JSON.parse(readFileSync('src/data/cards.snapshot.json', 'utf8')) as CardDbData;
const fixture = (name: string) => readFileSync(`fixtures/${name}`, 'utf8');
const source = (label: string, text: string): Source => ({
  id: label,
  label,
  kind: 'file',
  format: '',
  enabled: true,
  updatedAt: '',
  rows: parseCollection(text).rows,
});

describe('normalizePrinting', () => {
  it.each([
    ['OGN-001', 'OGN-001'],
    ['ogn-066a-298', 'OGN-066a'],
    ['OGN-066a/298', 'OGN-066a'],
    ['OGN-007A', 'OGN-007a'],
    ['SFD-148A', 'SFD-148a'],
    ['OGN-300*', 'OGN-300*'],
    ['unl-229*-219', 'UNL-229*'],
    ['SFD-227-STAR', 'SFD-227*'],
    ['ogn-301-star-298', 'OGN-301*'],
    ['OGN-299S', 'OGN-299*'],
    ['UNL-107-P', 'UNL-107-P'],
    ['OGN-263-Worlds', 'OGN-263-P'],
    ['OGN-001-Foil', 'OGN-001'],
    ['VEN-SP3/006', 'VEN-SP3'],
    ['ven-r01', 'VEN-R01'],
    ['https://cdn.piltoverarchive.com/cards/VEN-155.webp', 'VEN-155'],
    ['/img/cards/riftbound/UNL/unl-113-219_full.png', 'UNL-113'],
    ['https://example.com/Cards/UNL-205-horizontal.webp', 'UNL-205'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePrinting(input)).toBe(expected);
  });

  it('flags foil and ignores non-codes', () => {
    expect(parseCardCode('OGN-001-Foil')?.foil).toBe(true);
    expect(normalizePrinting('Jinx, Rebel')).toBeNull();
    expect(normalizePrinting('COVID-19')).toBeNull();
  });
});

describe('nameKey', () => {
  it('folds naming conventions across sites', () => {
    expect(nameKey('Jinx - Rebel')).toBe(nameKey('Jinx, Rebel'));
    expect(nameKey("Kai'Sa - Evolutionary")).toBe(nameKey('KaiSa, Evolutionary'));
    expect(nameKey('Stare Down (Unleashed Nexus Night Promo)')).toBe(nameKey('Stare Down'));
    expect(nameKey('Vi - Piltover Enforcer (Signature)')).toBe(nameKey('Vi, Piltover Enforcer'));
    expect(nameKey('Baron Nashor (Ultimate)')).not.toBe(nameKey('Baron Nashor'));
  });
});

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF and BOM', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['1', '2'],
    ]);
  });

  it('honours the Excel sep= hint', () => {
    expect(parseCsv('sep=;\na;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('CardDb', () => {
  const db = new CardDb(snapshot);

  it('resolves printings, alt arts, overnumbered and names', () => {
    expect(db.resolveCode('OGN-001')?.name).toBe('Blazing Scorcher');
    expect(db.resolveCode('UNL-107-P')?.name).toBe('Stare Down');
    expect(db.resolveCode('unl-229-219')?.key).toBe(nameKey('Vi, Piltover Enforcer'));
    expect(db.resolveCode('VEN-197')?.key).toBe(db.resolveCode('VEN-155')?.key);
    expect(db.resolveName('Master Yi, Wuju Bladesman')?.key).toBe(db.resolveCode('ogs-019-024')?.key);
  });
});

describe('collection formats', () => {
  it('parses the real riftbound.gg export', () => {
    const result = parseCollection(fixture('riftboundgg-collection.csv'));
    expect(result.format).toBe('riftboundgg');
    expect(result.rows).toHaveLength(504);
    expect(result.rows.reduce((s, r) => s + r.normal, 0)).toBe(952);
    expect(result.rows.reduce((s, r) => s + r.foil, 0)).toBe(355);
  });

  it('parses the real Piltover Archive export', () => {
    const result = parseCollection(fixture('piltover-collection.csv'));
    expect(result.format).toBe('piltover');
    expect(result.rows).toHaveLength(298);
    expect(result.rows.reduce((s, r) => s + r.normal + r.foil, 0)).toBe(952);
    expect(result.rows[0]).toEqual({ code: 'OGN-001', name: 'Blazing Scorcher', normal: 0, foil: 6 });
  });

  it.each([
    ['riftmana.csv', 'riftmana'],
    ['riftcore.csv', 'riftcore'],
    ['openrift.csv', 'openrift'],
    ['cardnexus.csv', 'cardnexus'],
    ['generic.csv', 'generic'],
    ['text-list.txt', 'text'],
  ])('detects %s as %s', (file, format) => {
    const result = parseCollection(fixture(file));
    expect(result.format).toBe(format);
    expect(result.rows.length).toBeGreaterThan(0);
    const blazing = result.rows.filter((r) => nameKey(r.name ?? '') === 'blazing scorcher' || r.code === 'OGN-001');
    expect(blazing.reduce((s, r) => s + r.normal + r.foil, 0)).toBe(3);
  });
});

describe('parsing edge cases', () => {
  const db = snapshot;
  const indexOf = (text: string) =>
    buildIndex(db, [{ id: 'x', label: 'x', kind: 'file', format: '', enabled: true, updatedAt: '', rows: parseCollection(text).rows }]);

  it('treats a generic "card" column holding names as names', () => {
    const result = parseCollection('Card,Quantity\n"Jinx, Rebel",2');
    expect(result.rows).toEqual([{ code: undefined, name: 'Jinx, Rebel', normal: 2, foil: 0 }]);
    expect(indexOf('Card,Quantity\n"Jinx, Rebel",2').owned['jinx rebel']?.normal).toBe(2);
  });

  it('treats header-less "name,qty" rows as names', () => {
    expect(indexOf('Blazing Scorcher,3\nCleave,1').owned['blazing scorcher']?.normal).toBe(3);
  });

  it('reads decimal quantities as whole copies', () => {
    expect(parseCollection('Card Name,Quantity\nBlazing Scorcher,2.0').rows[0]?.normal).toBe(2);
    expect(parseCollection('Card Name,Quantity\nBlazing Scorcher,-1').rows).toEqual([]);
  });

  it('uses one quantity column in generic files instead of adding up aliases', () => {
    const row = parseCollection('Card ID,Card Name,Normal,Foil,Quantity\nOGN-001,Blazing Scorcher,2,1,3').rows[0];
    expect(row).toMatchObject({ normal: 2, foil: 1 });
  });

  it('still adds up RiftCore standard + Proving Grounds columns', () => {
    const text = 'Card ID,Card Name,Standard Qty,Foil Qty,Proving Grounds Qty\nOGN-001,Blazing Scorcher,2,0,1';
    expect(parseCollection(text).rows[0]).toMatchObject({ normal: 3, foil: 0 });
  });
});

describe('buildIndex', () => {
  const rbgg = source('riftbound.gg', fixture('riftboundgg-collection.csv'));
  const index = buildIndex(snapshot, [rbgg]);

  it('sums every printing of a card by name', () => {
    const stareDown = index.owned[nameKey('Stare Down')];
    expect(stareDown?.normal).toBe(1);
    expect(stareDown?.foil).toBe(1);
    expect(stareDown?.printings).toEqual({ 'UNL-107': [1, 0], 'UNL-107-P': [0, 1] });

    const yasuo = index.owned[nameKey('Yasuo, Remorseful')];
    expect(yasuo?.printings['OGN-076']).toEqual([0, 2]);
    expect(yasuo?.printings['OGN-076a']).toEqual([0, 1]);
  });

  it('looks up page cards by code or name', () => {
    expect(lookupKey(index, 'https://cdn.piltoverarchive.com/cards/OGN-001.webp')).toBe('blazing scorcher');
    expect(lookupKey(index, null, 'Jinx, Demolitionist')).toBe(lookupKey(index, 'OGN-030'));
    expect(lookupKey(index, 'XYZ-999')).toBe('#XYZ-999');
  });

  it('matches every row of the real exports against the card DB', () => {
    const pa = source('Piltover', fixture('piltover-collection.csv'));
    expect(findUnmatched(snapshot, [rbgg, pa])).toEqual([]);
  });

  it('learns name aliases from collection rows', () => {
    // Riftcodex calls VEN-155 "Yordle, Kennen - Heart of the Tempest"; sites call it "Kennen, Heart of the Tempest".
    const row = { code: 'VEN-155', name: 'Kennen, Heart of the Tempest', normal: 1, foil: 0 };
    const withAlias = buildIndex(snapshot, [{ ...rbgg, rows: [row] }]);
    expect(lookupKey(withAlias, null, 'Kennen, Heart of the Tempest')).toBe(lookupKey(withAlias, 'VEN-155'));
  });

  it('skips disabled sources and aggregates per source', () => {
    const pa = source('Piltover', fixture('piltover-collection.csv'));
    const both = buildIndex(snapshot, [rbgg, pa]);
    expect(both.owned['blazing scorcher']?.sources).toEqual({ 'riftbound.gg': 7, Piltover: 6 });
    const onlyOne = buildIndex(snapshot, [rbgg, { ...pa, enabled: false }]);
    expect(onlyOne.owned['blazing scorcher']?.sources).toEqual({ 'riftbound.gg': 7 });
  });
});
