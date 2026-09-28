import { startAnnotator } from './annotator';
import { genericAdapter } from './sites/generic';

startAnnotator(genericAdapter, (settings) => settings.genericOrigins.includes(location.origin));
