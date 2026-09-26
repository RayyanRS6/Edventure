import type { FeeStatement, ReportCard } from '@edventure/contracts';
import { directionOf, localized, translate, type AppLocale } from '@edventure/i18n';

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Numbers, codes and dates stay left-to-right inside RTL pages. */
const ltr = (v: unknown) => `<bdi dir="ltr">${esc(v)}</bdi>`;

const fixed = (v: string | null | undefined, decimals = 2) => (v === null || v === undefined ? '—' : Number.parseFloat(v).toFixed(decimals));

export function layout(locale: AppLocale, title: string, body: string, school: { name: string; nameUr?: string | null }) {
  const dir = directionOf(locale);
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet" />
<style>
  :root { --ink:#16202a; --muted:#5b6673; --line:#d9dee4; --accent:#0f6e5a; --bad:#b42318; }
  * { box-sizing: border-box; }
  body { font-family: Inter, 'Noto Nastaliq Urdu', sans-serif; color: var(--ink); font-size: 11px; margin: 0; }
  [lang='ur'], .ur { font-family: 'Noto Nastaliq Urdu', Inter, serif; line-height: 2.1; }
  header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid var(--accent); padding-bottom:8px; margin-bottom:14px; }
  h1 { font-size: 18px; margin: 0; }
  h2 { font-size: 13px; margin: 18px 0 8px; color: var(--accent); }
  .muted { color: var(--muted); }
  table { width:100%; border-collapse: collapse; }
  th, td { border:1px solid var(--line); padding:5px 7px; text-align:start; vertical-align: top; }
  th { background:#f3f6f8; font-weight:600; }
  td.num, th.num { text-align:end; font-variant-numeric: tabular-nums; }
  .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin: 8px 0 12px; }
  .stat { border:1px solid var(--line); border-radius:6px; padding:8px; }
  .stat b { display:block; font-size:15px; margin-top:2px; }
  .pass { color: var(--accent); font-weight:600; }
  .fail { color: var(--bad); font-weight:600; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .sign { margin-top: 36px; display:flex; justify-content:space-between; }
  .sign div { border-top:1px solid var(--ink); width: 30%; padding-top:4px; text-align:center; }
</style>
</head>
<body>
<header>
  <div><h1>${esc(localized(locale, school.name, school.nameUr))}</h1><div class="muted">${esc(title)}</div></div>
  <div class="muted">${ltr(new Date().toISOString().slice(0, 10))}</div>
</header>
${body}
</body>
</html>`;
}

const t = (locale: AppLocale, key: string) => translate(locale, key);
const outcomeLabel = (locale: AppLocale, outcome: string) =>
  ({ pass: t(locale, 'exams.pass'), fail: t(locale, 'exams.fail'), incomplete: t(locale, 'exams.incomplete'), absent: t(locale, 'exams.absent'), exempt: t(locale, 'exams.exempt') })[outcome] ?? outcome;

export function reportCardBody(card: ReportCard, locale: AppLocale) {
  const r = card.result;
  const d = card.displayDecimals;
  const rows = r.subjects
    .map(
      (s) => `<tr>
        <td>${esc(localized(locale, s.subjectName, s.subjectNameUr))}</td>
        <td class="num">${ltr(fixed(s.obtainedMarks, d))}</td>
        <td class="num">${ltr(fixed(s.maxMarks, 0))}</td>
        <td class="num">${ltr(fixed(s.percentage, d))}</td>
        <td>${esc(s.gradeLabel ?? '—')}</td>
        <td class="${s.outcome === 'pass' ? 'pass' : s.outcome === 'fail' || s.outcome === 'absent' ? 'fail' : ''}">${esc(outcomeLabel(locale, s.outcome))}</td>
      </tr>`,
    )
    .join('');
  return `<section class="page">
  <table style="margin-bottom:10px">
    <tr><th>${esc(t(locale, 'nav.students'))}</th><td>${esc(localized(locale, card.student.displayName, card.student.displayNameUr))}</td>
        <th>#</th><td>${ltr(card.student.admissionNumber)}</td></tr>
    <tr><th>${esc(t(locale, 'nav.classes'))}</th><td>${esc(card.gradeName)} ${esc(card.sectionName ?? '')}</td>
        <th>${esc(t(locale, 'nav.exams'))}</th><td>${esc(card.examCycleName)} · ${ltr(card.academicYearCode)}</td></tr>
  </table>
  <table>
    <thead><tr><th>${esc(t(locale, 'nav.subjects'))}</th><th class="num">${esc(t(locale, 'exams.marks'))}</th><th class="num">${esc(t(locale, 'exams.maxMarks'))}</th>
      <th class="num">%</th><th>${esc(t(locale, 'exams.grade'))}</th><th>${esc(t(locale, 'common.status'))}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="grid">
    <div class="stat">${esc(t(locale, 'exams.marks'))}<b>${ltr(`${fixed(r.obtainedMarks, d)} / ${fixed(r.totalMarks, 0)}`)}</b></div>
    <div class="stat">${esc(t(locale, 'exams.percentage'))}<b>${ltr(fixed(r.percentage, d))}%</b></div>
    <div class="stat">${esc(t(locale, 'exams.grade'))}<b>${esc(r.gradeLabel ?? '—')}${r.gpa ? ` · GPA ${ltr(fixed(r.gpa, 2))}` : ''}</b></div>
    <div class="stat">${esc(t(locale, 'common.status'))}<b class="${r.outcome === 'pass' ? 'pass' : 'fail'}">${esc(outcomeLabel(locale, r.outcome))}</b></div>
  </div>
  <h2>${esc(t(locale, 'nav.attendance'))}</h2>
  <table><tr>
    <th>${esc(t(locale, 'attendance.present'))}</th><td class="num">${ltr(card.attendance.present)}</td>
    <th>${esc(t(locale, 'attendance.late'))}</th><td class="num">${ltr(card.attendance.late)}</td>
    <th>${esc(t(locale, 'attendance.absent'))}</th><td class="num">${ltr(card.attendance.absent)}</td>
    <th>${esc(t(locale, 'attendance.excused'))}</th><td class="num">${ltr(card.attendance.excused)}</td>
    <th>${esc(t(locale, 'attendance.rate'))}</th><td class="num">${ltr(card.attendance.rate ? `${card.attendance.rate}%` : t(locale, 'common.noData'))}</td>
  </tr></table>
  ${r.remarks ? `<h2>${esc(t(locale, 'leave.decisionNote'))}</h2><p>${esc(r.remarks)}</p>` : ''}
  <p class="muted">Rev. ${ltr(card.revision)} · ${ltr(card.publishedAt.slice(0, 10))}</p>
  <div class="sign"><div>${esc(t(locale, 'roles.classTeacher'))}</div><div>${esc(t(locale, 'roles.school_admin'))}</div><div>Parent / Guardian</div></div>
</section>`;
}

export function tableBody(headers: string[], rows: unknown[][], numericColumns: number[] = []) {
  const head = headers.map((h, i) => `<th class="${numericColumns.includes(i) ? 'num' : ''}">${esc(h)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c, i) => `<td class="${numericColumns.includes(i) ? 'num' : ''}">${numericColumns.includes(i) ? ltr(c) : esc(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function feeStatementBody(s: FeeStatement, locale: AppLocale) {
  const money = (v: string) => ltr(`${s.currency} ${Number.parseFloat(v).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`);
  const inv = s.invoices
    .map(
      (i) => `<tr><td>${ltr(i.invoiceNumber)}</td><td>${ltr(i.periodLabel)}</td><td>${ltr(i.dueDate)}</td>
      <td class="num">${money(i.totalAmount)}</td><td class="num">${money(i.paidAmount)}</td><td class="num">${money(i.adjustedAmount)}</td>
      <td class="num">${money(i.balance)}</td><td>${esc(t(locale, `fees.${i.feeStatus}`))}${i.overdue ? ` · <span class="fail">${esc(t(locale, 'fees.overdue'))}</span>` : ''}</td></tr>`,
    )
    .join('');
  const pays = s.payments
    .map((p) => `<tr><td>${ltr(p.receiptNumber)}</td><td>${ltr(p.receivedOn)}</td><td>${esc(p.method)}</td><td class="num">${money(p.amount)}</td><td>${esc(p.status)}</td></tr>`)
    .join('');
  return `<p><b>${esc(s.studentName)}</b> · ${ltr(s.admissionNumber)}</p>
  <div class="grid">
    <div class="stat">${esc(t(locale, 'fees.amount'))}<b>${money(s.totals.charged)}</b></div>
    <div class="stat">${esc(t(locale, 'fees.paidAmount'))}<b>${money(s.totals.paid)}</b></div>
    <div class="stat">${esc(t(locale, 'fees.balance'))}<b>${money(s.totals.balance)}</b></div>
    <div class="stat">${esc(t(locale, 'fees.overdue'))}<b>${money(s.totals.overdue)}</b></div>
  </div>
  <h2>${esc(t(locale, 'fees.invoice'))}</h2>
  <table><thead><tr><th>#</th><th></th><th>${esc(t(locale, 'fees.dueDate'))}</th><th class="num">${esc(t(locale, 'fees.amount'))}</th>
  <th class="num">${esc(t(locale, 'fees.paidAmount'))}</th><th class="num">±</th><th class="num">${esc(t(locale, 'fees.balance'))}</th><th>${esc(t(locale, 'common.status'))}</th></tr></thead>
  <tbody>${inv}</tbody></table>
  <h2>${esc(t(locale, 'fees.payment'))}</h2>
  <table><thead><tr><th>${esc(t(locale, 'fees.receipt'))}</th><th>${esc(t(locale, 'common.date'))}</th><th></th><th class="num">${esc(t(locale, 'fees.amount'))}</th><th></th></tr></thead>
  <tbody>${pays}</tbody></table>`;
}
