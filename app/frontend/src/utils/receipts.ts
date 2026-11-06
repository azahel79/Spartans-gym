import defaultLogo from '../assets/logo-2.png';
import type { Attendance, Transaction } from '../types';

interface ReceiptLine {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface ReceiptBrand {
  name?: string;
  logo?: string | null;
  phone?: string;
  address?: string;
  email?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  darkMode?: boolean;
}

interface SaleReceiptData {
  items: Array<{ name: string; quantity: number; price: number }>;
  paymentMethod: string;
  total: number;
  transaction?: Pick<Transaction, 'id' | 'fecha' | 'hora'>;
  brand?: ReceiptBrand;
}

const formatMoney = (value: number) =>
  value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const safeColor = (value: string | undefined, fallback: string) =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

const formatMexicoDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City',
  });
};

const openPrintableReceipt = (
  title: string,
  lines: ReceiptLine[],
  brand: ReceiptBrand = {},
  items: SaleReceiptData['items'] = []
) => {
  const primary = safeColor(brand.primaryColor, '#d60000');
  const secondary = safeColor(brand.secondaryColor, '#1f2937');
  const accent = safeColor(brand.accentColor, primary);
  const isDark = brand.darkMode === true;
  const contact = [brand.phone, brand.email].filter(Boolean).map(escapeHtml).join(' · ');
  const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${escapeHtml(title)} · MEXA GYM</title>
        <style>
          :root { --primary:${primary}; --secondary:${secondary}; --accent:${accent}; }
          * { box-sizing:border-box; }
          body {
            margin:0; padding:28px 16px; color:${isDark ? '#f5f7fa' : '#172033'};
            background:${isDark ? '#090d13' : '#eef2f7'};
            font-family:Inter,Arial,sans-serif;
          }
          .ticket {
            width:360px; max-width:100%; margin:0 auto; overflow:hidden;
            border:1px solid ${isDark ? '#354154' : '#d8dee8'}; border-radius:22px;
            background:${isDark ? '#151b24' : '#fff'};
            box-shadow:0 24px 70px rgba(0,0,0,.25);
          }
          .brand {
            padding:24px 22px 20px; text-align:center; color:white;
            background:linear-gradient(145deg,var(--primary),color-mix(in srgb,var(--primary) 68%,var(--secondary)));
          }
          .logo-wrap {
            display:flex; align-items:center; justify-content:center; width:76px; height:76px;
            margin:0 auto 10px; padding:7px; border-radius:20px;
            border:1px solid rgba(255,255,255,.48); background:rgba(255,255,255,.94);
          }
          .logo { width:100%; height:100%; object-fit:contain; }
          h1 { margin:0; font-size:23px; font-weight:900; letter-spacing:.08em; }
          .tagline { margin:4px 0 0; font-size:10px; font-weight:800; letter-spacing:.18em; opacity:.82; }
          .contact { margin-top:9px; font-size:10px; line-height:1.45; opacity:.86; }
          .content { padding:20px 22px 22px; }
          .title {
            margin:0 0 14px; color:var(--primary); text-align:center;
            font-size:12px; font-weight:900; letter-spacing:.15em; text-transform:uppercase;
          }
          .row {
            display:flex; justify-content:space-between; gap:18px; padding:8px 0;
            border-bottom:1px dashed ${isDark ? '#354154' : '#d8dee8'}; font-size:12px;
          }
          .row span:first-child { color:${isDark ? '#9facbd' : '#667085'}; }
          .row span:last-child { max-width:62%; text-align:right; font-weight:750; }
          .items { margin:15px 0 8px; }
          .item {
            display:grid; grid-template-columns:1fr auto; gap:12px; padding:9px 0;
            border-bottom:1px dashed ${isDark ? '#354154' : '#d8dee8'};
          }
          .item-name { font-size:12px; font-weight:800; }
          .item-detail { margin-top:3px; color:${isDark ? '#9facbd' : '#667085'}; font-size:10px; }
          .item-total { align-self:center; font-size:12px; font-weight:850; }
          .row.total {
            margin-top:12px; padding:15px 14px; border:0; border-radius:14px;
            background:color-mix(in srgb,var(--primary) ${isDark ? '18%' : '9%'},${isDark ? '#111720' : '#fff'});
          }
          .row.total span:first-child { color:${isDark ? '#d9e0ea' : '#344054'}; font-weight:800; }
          .row.total span:last-child { color:var(--primary); font-size:23px; font-weight:950; }
          .footer {
            margin-top:18px; padding-top:14px; border-top:1px solid ${isDark ? '#303a49' : '#e5e7eb'};
            text-align:center; color:${isDark ? '#9facbd' : '#667085'}; font-size:10px; line-height:1.55;
          }
          .footer strong { color:var(--primary); }
          @page { size:80mm auto; margin:5mm; }
          @media print {
            body { padding:0; color:#111; background:#fff; }
            .ticket { width:72mm; border:0; border-radius:0; box-shadow:none; background:#fff; }
            .brand { color:#fff !important; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
            .content { padding:4mm 2mm; }
            .row span:first-child,.item-detail,.footer { color:#555; }
            .row,.item,.footer { border-color:#aaa; }
            .row.total { background:#f4f4f4; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
          }
        </style>
      </head>
      <body>
        <article class="ticket">
          <header class="brand">
            <div class="logo-wrap"><img class="logo" src="${escapeHtml(brand.logo || defaultLogo)}" alt="MEXA GYM" /></div>
            <h1>MEXA GYM</h1>
            <p class="tagline">FUERZA · DISCIPLINA · RESULTADOS</p>
            ${contact ? `<div class="contact">${contact}</div>` : ''}
            ${brand.address ? `<div class="contact">${escapeHtml(brand.address)}</div>` : ''}
          </header>
          <section class="content">
            <h2 class="title">${escapeHtml(title)}</h2>
            ${lines.filter((line) => !line.emphasis).map((line) => `<div class="row"><span>${escapeHtml(line.label)}</span><span>${escapeHtml(line.value)}</span></div>`).join('')}
            ${items.length ? `<div class="items">${items.map((item) => `
              <div class="item">
                <div><div class="item-name">${escapeHtml(item.name)}</div><div class="item-detail">${item.quantity} × ${escapeHtml(formatMoney(item.price))}</div></div>
                <div class="item-total">${escapeHtml(formatMoney(item.price * item.quantity))}</div>
              </div>`).join('')}</div>` : ''}
            ${lines.filter((line) => line.emphasis).map((line) => `<div class="row total"><span>${escapeHtml(line.label)}</span><span>${escapeHtml(line.value)}</span></div>`).join('')}
            <footer class="footer"><strong>¡Gracias por tu compra!</strong><br/>Conserva este ticket como comprobante.</footer>
          </section>
        </article>
        <script>
          const logo = document.querySelector('.logo');
          const printReceipt = () => setTimeout(() => window.print(), 180);
          if (logo && !logo.complete) logo.addEventListener('load', printReceipt, { once:true });
          else printReceipt();
        </script>
      </body>
    </html>`;

  const receiptWindow = window.open('', '_blank', 'width=460,height=760');
  if (!receiptWindow) return;
  receiptWindow.document.write(html);
  receiptWindow.document.close();
};

export const printTransactionReceipt = (transaction: Transaction, brand?: ReceiptBrand) => {
  openPrintableReceipt('Recibo de pago', [
    { label: 'Folio', value: String(transaction.id) },
    { label: 'Fecha', value: `${transaction.fecha} ${transaction.hora}` },
    { label: 'Cliente', value: `${transaction.nombre} ${transaction.apellidos}` },
    { label: 'Concepto', value: transaction.concepto || 'Venta' },
    { label: 'Método', value: transaction.metodo },
    { label: 'Total', value: formatMoney(Number(transaction.monto || 0)), emphasis: true },
  ], brand);
};

export const printAttendanceReceipt = (attendance: Attendance, brand?: ReceiptBrand) => {
  openPrintableReceipt('Comprobante de asistencia', [
    { label: 'Folio', value: String(attendance.id) },
    { label: 'Fecha', value: `${formatMexicoDateTime(attendance.fecha)} (${attendance.hora})` },
    { label: 'Socio', value: `${attendance.nombre} ${attendance.apellidos}` },
    { label: 'Plan', value: attendance.plan },
    { label: 'Estado', value: attendance.status },
  ], brand);
};

export const printSaleReceipt = ({ items, paymentMethod, total, transaction, brand }: SaleReceiptData) => {
  openPrintableReceipt('Ticket de compra', [
    { label: 'Folio', value: transaction ? String(transaction.id) : 'Venta POS' },
    {
      label: 'Fecha',
      value: transaction
        ? `${transaction.fecha} ${transaction.hora}`
        : new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
    },
    { label: 'Método de pago', value: paymentMethod },
    { label: 'Total', value: formatMoney(total), emphasis: true },
  ], brand, items);
};
