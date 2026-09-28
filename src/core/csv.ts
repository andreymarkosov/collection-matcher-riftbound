/** RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, BOM, Excel `sep=` hint line. */
export function parseCsv(text: string): string[][] {
  let src = text.replace(/^﻿/, '');
  let delimiter = ',';
  const sepHint = /^sep=(.)\r?\n/i.exec(src);
  if (sepHint?.[1]) {
    delimiter = sepHint[1];
    src = src.slice(sepHint[0].length);
  } else {
    delimiter = sniffDelimiter(src);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;

  const endField = () => {
    row.push(fieldStarted ? field : field.trim());
    field = '';
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((v) => v !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.trim() === '') {
      quoted = true;
      fieldStarted = true;
      field = '';
    } else if (ch === delimiter) {
      endField();
    } else if (ch === '\n') {
      endRow();
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

function sniffDelimiter(src: string): string {
  const firstLines = src.split(/\r?\n/, 5).join('\n');
  const counts = [',', ';', '\t'].map((d) => [d, firstLines.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]?.[0] ?? ',';
}
