import { startAnnotator } from './annotator';
import { piltoverAdapter } from './sites/piltover';
import { riftboundggAdapter } from './sites/riftboundgg';
import { riftdecksAdapter } from './sites/riftdecks';
import type { SiteId } from '../shared/storage';
import { installDevBridge } from './dev-bridge';
import type { SiteAdapter } from './types';

const ADAPTERS: Record<string, { site: SiteId; adapter: SiteAdapter }> = {
  'piltoverarchive.com': { site: 'piltover', adapter: piltoverAdapter },
  'riftbound.gg': { site: 'riftboundgg', adapter: riftboundggAdapter },
  'riftdecks.com': { site: 'riftdecks', adapter: riftdecksAdapter },
};

const host = location.hostname.replace(/^www\./, '');
const entry = ADAPTERS[host];
if (entry) startAnnotator(entry.adapter, (settings) => settings.sites[entry.site]);

if (__DEV__) installDevBridge();
