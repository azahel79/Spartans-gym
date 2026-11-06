export interface ExcelSection {
  title: string;
  headers: string[];
  rows: unknown[][];
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeFileName = (fileName: string): string =>
  fileName.endsWith('.xls') ? fileName : fileName.replace(/\.[^.]+$/, '') + '.xls';

const renderRows = (rows: unknown[][]) => {
  if (rows.length === 0) {
    return '<tr><td class="empty" colspan="20">Sin registros para mostrar</td></tr>';
  }

  return rows.map((row) => `
    <tr>
      ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
    </tr>
  `).join('');
};

export function downloadStyledExcel(fileName: string, title: string, sections: ExcelSection[]) {
  const generatedAt = new Date().toLocaleString('es-MX');
  const content = sections.map((section) => `
    <h2>${escapeHtml(section.title)}</h2>
    <table>
      <thead>
        <tr>${section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>${renderRows(section.rows)}</tbody>
    </table>
  `).join('');
  const html = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { margin: 0 0 6px; color: #991b1b; font-size: 22px; font-weight: 700; }
    .meta { margin: 0 0 18px; color: #4b5563; font-size: 12px; }
    h2 { margin: 22px 0 8px; color: #111827; font-size: 16px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th { background: #dc2626; color: #ffffff; font-weight: 700; border: 1px solid #b91c1c; padding: 9px; text-align: left; }
    td { border: 1px solid #e5e7eb; padding: 8px; mso-number-format: "\\@"; }
    tr:nth-child(even) td { background: #f9fafb; }
    .empty { color: #6b7280; font-style: italic; text-align: center; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta"><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
  ${content}
</body>
</html>`;

  const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = normalizeFileName(fileName);
  link.click();
  URL.revokeObjectURL(url);
}
