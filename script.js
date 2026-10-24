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

let lastId = null, sort = {key: null, dir: 1};
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
    <tr data-id="${x.id}" class="${x.id === lastId ? 'row-in' : ''}">
      <td class="sn">${i + 1}</td><td class="person">${esc(x.person)}</td>
      <td class="date">${esc(x.date)}</td><td class="item">${esc(x.item)}</td>
      <td class="amt">${money(x.amount)}</td>
      <td class="act"><button class="del" data-del="${x.id}" aria-label="Delete ${esc(x.item)}" title="Delete"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button></td>
    </tr>`).join('');
  lastId = null;
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
  if (expenses.some(e => e.person === person && e.date === date && e.item === item && e.amount === amount)) return fail('This expense is already in the list.');
  $('err').hidden = true;
  const x = {id: Date.now() + Math.random(), person, date, item, amount};
  expenses.push(x); lastId = x.id; save();
  $('person').value = ''; $('item').value = ''; $('amount').value = ''; $('date').valueAsDate = new Date(); $('person').focus();
  render();
});

$('list').addEventListener('click', e => {
  const b = e.target.closest('[data-del]');
  if (!b) return;
  const tr = b.closest('tr'), id = parseFloat(b.dataset.del);
  const done = () => { expenses = expenses.filter(x => x.id !== id); save(); render(); };
  tr.classList.add('row-out');
  setTimeout(done, matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 230);
});

$('pdf').addEventListener('click', () => {
  if (!window.jspdf) { window.print(); return; }
  const {jsPDF} = window.jspdf, doc = new jsPDF(), c = compute();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
  const TEAL = [15, 92, 87], GOLD = [242, 169, 59], INK = [15, 47, 46], MUTED = [93, 115, 113],
        SOFT = [242, 245, 243], RED = [192, 57, 43], GREEN = [29, 122, 79];
  const pm = n => 'Rs. ' + n.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const dates = expenses.map(x => x.date).sort();
  const period = dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : dates[0] + ' to ' + dates[dates.length - 1]) : 'No expenses';

  // header band
  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 36, 'F');
  doc.setFillColor(...GOLD); doc.rect(0, 36, W, 2, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text('Expense Report', M, 18);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(period + '   |   Generated ' + new Date().toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}), M, 27);

  // stat cards
  const stats = [['Total spent', pm(c.total)], ['People', String(c.people.length)], ['Each share', pm(c.share)]];
  const cw = (W - 2 * M - 12) / 3;
  stats.forEach(([label, val], i) => {
    const x = M + i * (cw + 6);
    doc.setFillColor(...SOFT); doc.roundedRect(x, 46, cw, 22, 3, 3, 'F');
    doc.setFillColor(...GOLD); doc.rect(x, 50, 1.5, 14, 'F');
    doc.setTextColor(...MUTED); doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(label, x + 6, 55);
    doc.setTextColor(...INK); doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text(val, x + 6, 63);
  });

  let y = 82;
  const section = title => {
    if (y > H - 50) { doc.addPage(); y = 20; }
    doc.setFillColor(...GOLD); doc.rect(M, y - 5, 2, 7, 'F');
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(title, M + 5, y);
    y += 4;
  };
  const table = (head, body, opts = {}) => {
    doc.autoTable({startY: y, head: [head], body, theme: 'striped', margin: {left: M, right: M},
      styles: {fontSize: 10, cellPadding: 3, textColor: INK, lineWidth: 0},
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
  table(['From', 'To', 'Amount'],
    c.pays.length ? c.pays.map(x => [x.from, x.to, pm(x.amt)]) : [['Everyone is settled up', '', '']],
    {columnStyles: {2: {halign: 'right', fontStyle: 'bold'}}});

  // footer on every page
  const n = doc.internal.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GOLD); doc.setLineWidth(.4); doc.line(M, H - 14, W - M, H - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text('Powered by @eswar', M, H - 8);
    doc.text('Page ' + p + ' of ' + n, W - M, H - 8, {align: 'right'});
  }
  doc.save('expense-report.pdf');
});

render();
