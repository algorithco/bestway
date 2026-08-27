/**
 * Excel/Google Sheets to'g'ri ochishi uchun CSV: boshida BOM (UTF-8),
 * ustunlar nuqta-vergul (;) bilan ajratiladi (Yevropa/rus lokalida vergul o'nlik belgisi).
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null): string => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(';'), ...rows.map((r) => r.map(esc).join(';'))];
  return '﻿' + lines.join('\r\n');
}
