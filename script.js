const $ = id => document.getElementById(id);
const KEY = 'expenses-v1';
let expenses = [];
try { expenses = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(expenses)); } catch (e) {} };
const money = n => '₹' + n.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('date').valueAsDate = new Date();

const root = document.documentElement;
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
function paintToggle() {
  $('theme').textContent = isDark() ? '☀' : '☾';
  $('theme').setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
}
$('theme').addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
  paintToggle();
});
paintToggle();

let shownTotal = 0;
function countTo(el, to) {
  const from = shownTotal, t0 = performance.now(), dur = 400;
  shownTotal = to;
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) { el.textContent = money(to); return; }
  (function step(t) {
    const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
    el.textContent = money(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

function compute() {
  const totals = {};
  expenses.forEach(x => totals[x.person] = (totals[x.person] || 0) + x.amount);
  const people = Object.keys(totals);
  const total = people.reduce((s, p) => s + totals[p], 0);
  const share = people.length ? total / people.length : 0;
  const bal = people.map(p => ({p, v: Math.round((totals[p] - share) * 100) / 100}));
  const debtors = bal.filter(b => b.v < 0).map(b => ({...b})).sort((a, b) => a.v - b.v);
  const creditors = bal.filter(b => b.v > 0).map(b => ({...b})).sort((a, b) => b.v - a.v);
  const pays = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(-debtors[i].v, creditors[j].v);
    if (amt > 0.004) pays.push({from: debtors[i].p, to: creditors[j].p, amt});
    debtors[i].v += amt; creditors[j].v -= amt;
    if (Math.abs(debtors[i].v) < 0.005) i++;
    if (Math.abs(creditors[j].v) < 0.005) j++;
  }
  return {totals, people, total, share, pays};
}

let editingId = null, lastId = null, sort = {key: null, dir: 1};
const view = () => {
  if (!sort.key) return expenses;
  const k = sort.key;
  return [...expenses].sort((a, b) => (k === 'amount' ? a.amount - b.amount : String(a[k]).localeCompare(String(b[k]))) * sort.dir);
};
document.querySelectorAll('th[data-sort]').forEach(th => {
  const go = () => {
    const k = th.dataset.sort;
    sort = {key: k, dir: sort.key === k ? -sort.dir : 1};
    document.querySelectorAll('th[data-sort]').forEach(t => t.classList.remove('asc', 'desc'));
    th.classList.add(sort.dir === 1 ? 'asc' : 'desc');
    render();
  };
  th.addEventListener('click', go);
  th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
});
function render() {
  const body = $('list');
  body.innerHTML = view().map((x, i) => `
    <tr data-id="${x.id}" class="${x.id === lastId ? 'row-in' : ''} ${x.id === editingId ? 'editing' : ''}">
      <td class="sn">${i + 1}</td><td class="person">${esc(x.person)}</td>
      <td class="date">${esc(x.date)}</td><td class="item">${esc(x.item)}</td>
      <td class="amt">${money(x.amount)}</td>
      <td class="act"><button class="edit" data-edit="${x.id}" aria-label="Edit ${esc(x.item)}" title="Edit"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button><button class="del" data-del="${x.id}" aria-label="Delete ${esc(x.item)}" title="Delete"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button></td>
    </tr>`).join('');
  lastId = null;
  ['clear', 'pdf', 'share'].forEach(k => { $(k).disabled = !expenses.length; });
  $('empty').style.display = expenses.length ? 'none' : 'block';
  document.querySelector('table').style.display = expenses.length ? '' : 'none';

  const c = compute();
  countTo($('total'), c.total);
  $('summary').innerHTML = c.people.length
    ? c.people.map(p => {
        const d = Math.round((c.share - c.totals[p]) * 100) / 100;
        const note = d > 0 ? `<em class="pay-neg">needs to pay ${money(d)}</em>` : d < 0 ? `<em class="pay-pos">needs to receive ${money(-d)}</em>` : '<em>settled</em>';
        return `<div class="chip"><b>${money(c.totals[p])}</b><span>${esc(p)} paid</span>${note}</div>`;
    }).join('')
      + `<div class="chip"><b>${money(c.share)}</b><span>Each person's share</span></div>`
    : '<div class="empty">Totals appear here.</div>';
  $('settle').innerHTML = c.pays.length
    ? c.pays.map(x => `<div class="pay"><span>${esc(x.from)}</span><span class="arrow">pays</span><span>${esc(x.to)}</span><span class="amt">${money(x.amt)}</span></div>`).join('')
    : `<div class="empty">${expenses.length ? 'Everyone is settled up.' : 'Add expenses to see who pays whom.'}</div>`;
}

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const amount = parseFloat($('amount').value);
  let person = $('person').value.trim();
  const date = $('date').value; let item = $('item').value.trim();
  const fail = m => { $('err').textContent = m; $('err').hidden = false; };
  if (!person || !isNaN(person)) return fail('Enter a name for the person (numbers alone are not allowed).');
  if (isNaN(amount) || amount < 0) return fail('Enter an amount of 0 or more.');
  if (!item && amount === 0) item = 'No expense';
  if (!item || !isNaN(item)) return fail('Enter an item name (numbers alone are not allowed).');
  if (!date) return fail('Pick a date.');
  person = person.charAt(0).toUpperCase() + person.slice(1).toLowerCase();
  if (expenses.some(e => e.id !== editingId && e.person === person && e.date === date && e.item === item && e.amount === amount)) return fail('This expense is already in the list.');
  $('err').hidden = true;
  if (editingId !== null) {
    const t = expenses.find(e => e.id === editingId);
    if (t) Object.assign(t, {person, date, item, amount});
    lastId = editingId; endEdit();
  } else {
    const x = {id: Date.now() + Math.random(), person, date, item, amount};
    expenses.push(x); lastId = x.id; resetForm();
  }
  save(); render();
});

function resetForm() {
  $('person').value = ''; $('item').value = ''; $('amount').value = ''; $('date').valueAsDate = new Date(); $('person').focus();
}
function endEdit() {
  editingId = null;
  $('formTitle').textContent = 'Add expense'; $('submit').textContent = 'Add expense'; $('cancel').hidden = true;
  $('err').hidden = true; resetForm();
}
$('cancel').addEventListener('click', () => { endEdit(); render(); });

$('list').addEventListener('click', e => {
  const eb = e.target.closest('[data-edit]');
  if (eb) {
    const x = expenses.find(v => v.id === parseFloat(eb.dataset.edit));
    if (!x) return;
    editingId = x.id;
    $('person').value = x.person; $('date').value = x.date; $('item').value = x.item; $('amount').value = x.amount;
    $('formTitle').textContent = 'Edit expense'; $('submit').textContent = 'Save changes'; $('cancel').hidden = false; $('err').hidden = true;
    render();
    $('form').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'center'});
    $('person').focus({preventScroll: true});
    return;
  }
  const b = e.target.closest('[data-del]');
  if (!b) return;
  const tr = b.closest('tr'), id = parseFloat(b.dataset.del);
  const done = () => { expenses = expenses.filter(x => x.id !== id); if (id === editingId) endEdit(); save(); render(); };
  tr.classList.add('row-out');
  setTimeout(done, matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 230);
});

let clearTimer = null;
function resetClear() { clearTimeout(clearTimer); clearTimer = null; $('clear').textContent = 'Clear all'; $('clear').classList.remove('confirm'); }
$('clear').addEventListener('click', () => {
  if (!clearTimer) {
    $('clear').textContent = 'Tap again to confirm'; $('clear').classList.add('confirm');
    clearTimer = setTimeout(resetClear, 4000);
    return;
  }
  resetClear(); expenses = []; sort = {key: null, dir: 1};
  document.querySelectorAll('th[data-sort]').forEach(t => t.classList.remove('asc', 'desc'));
  if (editingId !== null) endEdit();
  save(); render();
});

// Fonts come from fonts.js (embedded), so no extra files or network requests are needed
const fontData = window.NOTO_SANS || null;
const fontsReady = Promise.resolve();

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const p2 = n => String(n).padStart(2, '0');
const stamp = d => { const h = d.getHours() % 12 || 12; return `${p2(d.getDate())}-${MON[d.getMonth()]}-${d.getFullYear()} ${p2(h)}:${p2(d.getMinutes())} ${d.getHours() >= 12 ? 'PM' : 'AM'}`; };
// Same data on the same day keeps the same invoice number, so Download and Share match
function invoiceNo(now) {
  const ymd = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}`;
  const sig = ymd + JSON.stringify(expenses.map(x => [x.person, x.date, x.item, x.amount]));
  try {
    const last = JSON.parse(localStorage.getItem('invoice-last') || 'null');
    if (last && last.sig === sig) return last.no;
    const seq = (parseInt(localStorage.getItem('invoice-seq'), 10) || 0) + 1;
    const no = `INV-${ymd}-${String(seq).padStart(4, '0')}`;
    localStorage.setItem('invoice-seq', seq); localStorage.setItem('invoice-last', JSON.stringify({sig, no}));
    return no;
  } catch (e) { return `INV-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`; }
}

async function buildPdf() {
  if (!window.jspdf) return null;
  await fontsReady;
  const {jsPDF} = window.jspdf, doc = new jsPDF(), c = compute();
  const now = new Date(), inv = invoiceNo(now); doc.invoiceNo = inv;
  let F = 'helvetica', cur = 'Rs. ';
  if (fontData) {
    doc.addFileToVFS('NotoSans-Regular.ttf', fontData.normal); doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.addFileToVFS('NotoSans-Bold.ttf', fontData.bold); doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    F = 'NotoSans'; cur = '₹';
  }
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
  const TEAL = [15, 92, 87], GOLD = [242, 169, 59], INK = [15, 47, 46], MUTED = [93, 115, 113],
        SOFT = [242, 245, 243], RED = [192, 57, 43], GREEN = [29, 122, 79];
  const pm = n => cur + n.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

  // header band
  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 36, 'F');
  doc.setFillColor(...GOLD); doc.rect(0, 36, W, 2, 'F');
  doc.setTextColor(255); doc.setFont(F, 'bold'); doc.setFontSize(24); doc.text('Expense Report', M, 23);
  doc.setFont(F, 'normal'); doc.setFontSize(10);
  doc.setFontSize(9); doc.text('INVOICE NO.', W - M, 13, {align: 'right'});
  doc.setFont(F, 'bold'); doc.setFontSize(13); doc.text(inv, W - M, 20, {align: 'right'});
  doc.setFont(F, 'normal'); doc.setFontSize(9); doc.text('Generated ' + stamp(now), W - M, 27, {align: 'right'});

  // stat cards
  const stats = [['Total spent', pm(c.total)], ['People', String(c.people.length)], ['Each share', pm(c.share)]];
  const cw = (W - 2 * M - 12) / 3;
  stats.forEach(([label, val], i) => {
    const x = M + i * (cw + 6);
    doc.setFillColor(...SOFT); doc.roundedRect(x, 46, cw, 22, 3, 3, 'F');
    doc.setFillColor(...GOLD); doc.rect(x, 50, 1.5, 14, 'F');
    doc.setTextColor(...MUTED); doc.setFontSize(9); doc.setFont(F, 'normal'); doc.text(label, x + 6, 55);
    doc.setTextColor(...INK); doc.setFontSize(13); doc.setFont(F, 'bold'); doc.text(val, x + 6, 63);
  });

  let y = 82;
  const section = title => {
    if (y > H - 50) { doc.addPage(); y = 20; }
    doc.setFillColor(...GOLD); doc.rect(M, y - 5, 2, 7, 'F');
    doc.setTextColor(...INK); doc.setFont(F, 'bold'); doc.setFontSize(13); doc.text(title, M + 5, y);
    y += 4;
  };
  const table = (head, body, opts = {}) => {
    doc.autoTable({startY: y, head: [head], body, theme: 'striped', margin: {left: M, right: M},
      styles: {font: F, fontSize: 10, cellPadding: 3, textColor: INK, lineWidth: 0},
      headStyles: {fillColor: TEAL, textColor: 255, fontStyle: 'bold'},
      alternateRowStyles: {fillColor: SOFT}, ...opts,
      didParseCell: d => {
        const cs = (opts.columnStyles || {})[d.column.index];
        if (d.section === 'head' && cs && cs.halign) d.cell.styles.halign = cs.halign;
        if (opts.didParseCell) opts.didParseCell(d);
      }});
    y = doc.lastAutoTable.finalY + 12;
  };

  section('Expenses');
  table(['#', 'Person', 'Date', 'Item', 'Amount'],
    expenses.length ? expenses.map((x, i) => [i + 1, x.person, x.date, x.item, pm(x.amount)]) : [['', 'No expenses added', '', '', '']],
    {columnStyles: {0: {cellWidth: 12}, 4: {halign: 'right', fontStyle: 'bold'}}});

  section('Summary by person');
  table(['Person', 'Paid', 'Share', 'Balance'],
    c.people.map(p => {
      const d = Math.round((c.share - c.totals[p]) * 100) / 100;
      return [p, pm(c.totals[p]), pm(c.share), d > 0 ? 'Owes ' + pm(d) : d < 0 ? 'Gets back ' + pm(-d) : 'Settled'];
    }),
    {columnStyles: {1: {halign: 'right'}, 2: {halign: 'right'}, 3: {halign: 'right', fontStyle: 'bold'}},
     didParseCell: d => {
       if (d.section === 'body' && d.column.index === 3) d.cell.styles.textColor = d.cell.raw.startsWith('Owes') ? RED : d.cell.raw.startsWith('Gets') ? GREEN : MUTED;
     }});

  section('Who pays whom');
  table(['From', 'To', 'Action', 'Amount'],
    c.pays.length ? c.pays.map(x => [x.from, x.to, 'Needs Pay', pm(x.amt)]) : [['Everyone is settled up', '', '', '']],
    {columnStyles: {2: {halign: 'center'}, 3: {halign: 'right', fontStyle: 'bold'}},
     didParseCell: d => {
       if (d.section === 'body' && d.column.index === 2 && d.cell.raw === 'Needs Pay') {
         d.cell.styles.textColor = RED; d.cell.styles.fontStyle = 'bold';
       }
     }});

  // footer on every page
  const n = doc.internal.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GOLD); doc.setLineWidth(.4); doc.line(M, H - 14, W - M, H - 14);
    doc.setFont(F, 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text('Powered by @eswar', M, H - 8);
    doc.text(inv, W / 2, H - 8, {align: 'center'});
    doc.text('Page ' + p + ' of ' + n, W - M, H - 8, {align: 'right'});
  }
  return doc;
}

const fileName = d => d.invoiceNo + '.pdf';
const note = m => { $('note').textContent = m; $('note').hidden = !m; };
async function busy(btn, fn) {
  const label = btn.textContent; btn.disabled = true; btn.textContent = 'Preparing…'; note('');
  try { await fn(); } finally { btn.textContent = label; btn.disabled = !expenses.length; }
}
$('pdf').addEventListener('click', () => busy($('pdf'), async () => {
  const doc = await buildPdf();
  if (!doc) { window.print(); return; }
  doc.save(fileName(doc));
}));
$('share').addEventListener('click', () => busy($('share'), async () => {
  const doc = await buildPdf();
  if (!doc) { window.print(); return; }
  const file = new File([doc.output('blob')], fileName(doc), {type: 'application/pdf'});
  if (navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: 'Expense report'}); }
    catch (e) { if (e.name !== 'AbortError') { doc.save(fileName(doc)); note('Sharing did not open, so the PDF was downloaded. Attach it in WhatsApp.'); } }
  } else {
    doc.save(fileName(doc));
    note('This device cannot share files directly, so the PDF was downloaded. Attach it in WhatsApp.');
  }
}));


render();
