import { DIRECT_EXPENSE_FIELDS, FIXED_EXPENSE_FIELDS, calculate } from './calculator.js';
import { createLedgerStorage } from './storage.js';

const storage = createLedgerStorage();
const diagnostics = { errors: [] };
window.__LEDGER_DIAGNOSTICS__ = diagnostics;
window.addEventListener('error', (event) => diagnostics.errors.push(String(event.message || event.error)));
window.addEventListener('unhandledrejection', (event) => diagnostics.errors.push(String(event.reason)));

const byId = (id) => document.getElementById(id);
const views = [...document.querySelectorAll('.view')];
const form = byId('ledger-form');
let activeMonth = currentMonth();

function currentMonth() {
  const now = new Date();
  const month = now.getMonth() + 1;
  return `${now.getFullYear()}-${month < 10 ? `0${month}` : month}`;
}

function monthLabel(month) {
  const [year, monthNumber] = String(month || '').split('-');
  return year && monthNumber ? `${year} 年 ${Number(monthNumber)} 月` : String(month || '');
}

function formatAmount(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(2).replace(/\.00$/, '')}%`;
}

function amountWithUnit(value) {
  return value === null || value === undefined ? '—' : `${formatAmount(value)} 元`;
}

function breakEvenText(result) {
  if (result.breakEvenReason === 'ZERO_NET_REVENUE') return '销售净收入为 0，暂时无法计算保本营业额。';
  if (result.breakEvenReason === 'NON_POSITIVE_NET_REVENUE') return '销售净收入小于 0，暂时无法计算普通保本营业额。';
  if (result.breakEvenReason === 'NON_POSITIVE_CONTRIBUTION') {
    return '当前销售产生的贡献利润为零或负数。按照现在的商品成本和订单费用结构，仅增加销售额不能正常实现保本，请先检查商品成本、广告、物流、平台等直接费用。';
  }
  if (result.breakEvenStatus === 'ABOVE') return `本月已超过保本线 ${formatAmount(result.breakEvenDifference)} 元`;
  if (result.breakEvenStatus === 'BELOW') return `距离保本还差 ${formatAmount(result.breakEvenDifference)} 元`;
  return '本月刚好达到保本线';
}

function setStatus(message) {
  byId('app-status').textContent = message;
}

function showView(name) {
  views.forEach((view) => {
    const active = view.dataset.view === name;
    view.hidden = !active;
    view.classList.toggle('active', active);
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function routeTo(name, month = '') {
  const suffix = month ? `/${month}` : '';
  const hash = `#${name}${suffix}`;
  if (window.location.hash === hash) renderRoute();
  else window.location.hash = hash;
}

function readRoute() {
  const raw = window.location.hash.replace(/^#/, '') || 'home';
  const [name, month] = raw.split('/');
  return { name: ['home', 'entry', 'result', 'history'].includes(name) ? name : 'home', month };
}

function createMoneyFields(container, definitions) {
  definitions.forEach(({ key, label }) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'field';
    wrapper.htmlFor = key;
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('input');
    input.id = key;
    input.name = key;
    input.type = 'number';
    input.min = '0';
    input.step = '0.01';
    input.inputMode = 'decimal';
    input.placeholder = '0';
    wrapper.append(text, input);
    container.append(wrapper);
  });
}

function readForm() {
  const values = Object.fromEntries(new FormData(form).entries());
  values.month = byId('entry-month').value;
  return values;
}

function displayInputValue(value) {
  return value === 0 || value === undefined || value === null ? '' : String(value);
}

function setFormValue(key, value) {
  const input = form.elements.namedItem(key);
  if (input && input instanceof HTMLInputElement) input.value = displayInputValue(value);
}

function toggleCostMode() {
  const mode = new FormData(form).get('costMode') || 'simple';
  byId('simple-cost-fields').hidden = mode !== 'simple';
  byId('inventory-cost-fields').hidden = mode !== 'inventory';
  updateLiveResult();
}

function populateForm(month) {
  form.reset();
  byId('form-errors').hidden = true;
  const record = storage.getMonthlyRecord(month);
  byId('entry-month').value = month;
  if (record) {
    Object.entries(record.input).forEach(([key, value]) => {
      if (key === 'costMode') return;
      setFormValue(key, value);
    });
    const modeInput = form.querySelector(`input[name="costMode"][value="${record.input.costMode}"]`);
    if (modeInput) modeInput.checked = true;
  }
  toggleCostMode();
  updateLiveResult();
}

function updateLiveResult() {
  const result = calculate(readForm());
  const target = byId('live-profit');
  target.textContent = result.valid ? formatAmount(result.operatingProfit) : '—';
  target.classList.toggle('negative-text', result.valid && result.operatingProfit < 0);
}

function paintProfit(element, value) {
  element.textContent = formatAmount(value);
  element.classList.toggle('negative-text', value < 0);
}

function renderHome(month = activeMonth) {
  activeMonth = month || currentMonth();
  byId('home-month').value = activeMonth;
  const record = storage.getMonthlyRecord(activeMonth);
  byId('home-empty').hidden = Boolean(record);
  byId('home-summary').hidden = !record;
  if (!record) return;
  const result = calculate(record.input);
  if (!result.valid) return;
  paintProfit(byId('home-operating-profit'), result.operatingProfit);
  byId('home-net-margin').textContent = formatPercent(result.netMargin);
  byId('home-gross-profit').textContent = formatAmount(result.grossProfit);
  byId('home-contribution-profit').textContent = formatAmount(result.contributionProfit);
  byId('home-break-even').textContent = amountWithUnit(result.breakEvenRevenue);
  byId('home-break-even-text').textContent = breakEvenText(result);
}

function setResultText(key, value) {
  byId(`result-${key}`).textContent = value;
}

function renderResult(month) {
  const record = storage.getMonthlyRecord(month);
  if (!record) {
    activeMonth = month || currentMonth();
    routeTo('home', activeMonth);
    return false;
  }
  activeMonth = month;
  const result = calculate(record.input);
  if (!result.valid) return false;
  byId('result-month').textContent = monthLabel(month);
  paintProfit(byId('result-operatingProfit'), result.operatingProfit);
  setResultText('netMargin', formatPercent(result.netMargin));
  setResultText('netRevenue', formatAmount(result.netRevenue));
  setResultText('goodsCost', formatAmount(result.goodsCost));
  setResultText('grossProfit', formatAmount(result.grossProfit));
  setResultText('grossMargin', formatPercent(result.grossMargin));
  setResultText('directExpenses', formatAmount(result.directExpenses));
  setResultText('contributionProfit', formatAmount(result.contributionProfit));
  setResultText('contributionMargin', formatPercent(result.contributionMargin));
  setResultText('fixedExpenses', formatAmount(result.fixedExpenses));
  setResultText('finalProfit', formatAmount(result.operatingProfit));
  byId('result-finalProfit').classList.toggle('negative-text', result.operatingProfit < 0);
  setResultText('finalNetMargin', formatPercent(result.netMargin));
  setResultText('averageOrderRevenue', amountWithUnit(result.averageOrderRevenue));
  setResultText('averageOrderProfit', amountWithUnit(result.averageOrderProfit));
  setResultText('breakEvenRevenue', amountWithUnit(result.breakEvenRevenue));
  setResultText('breakEvenText', breakEvenText(result));

  const ranking = byId('cost-ranking');
  ranking.replaceChildren();
  if (!result.costBreakdown.length) {
    const empty = document.createElement('p');
    empty.className = 'section-note';
    empty.textContent = '本月还没有填写成本。';
    ranking.append(empty);
  } else {
    result.costBreakdown.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'cost-row';
      const rank = document.createElement('span');
      rank.className = 'cost-rank';
      rank.textContent = String(index + 1);
      const label = document.createElement('span');
      label.textContent = item.label;
      const amount = document.createElement('span');
      amount.className = 'cost-amount';
      amount.textContent = `${formatAmount(item.amount)} 元`;
      row.append(rank, label, amount);
      ranking.append(row);
    });
  }
  return true;
}

function deleteMonth(month, returnTo = 'history') {
  const confirmed = window.confirm(`确认删除 ${monthLabel(month)} 的全部账本数据？删除后无法恢复。`);
  if (!confirmed) return false;
  storage.deleteMonthlyRecord(month);
  setStatus(`${monthLabel(month)} 已删除`);
  if (returnTo === 'home') routeTo('home', month);
  else renderHistory();
  return true;
}

function createHistoryButton(label, action, danger = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `small-button${danger ? ' danger' : ''}`;
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function renderHistory() {
  const records = storage.listMonthlyRecords();
  const list = byId('history-list');
  list.replaceChildren();
  byId('history-empty').hidden = records.length > 0;
  byId('history-add').hidden = records.length === 0;
  records.forEach((record) => {
    const result = calculate(record.input);
    const card = document.createElement('article');
    card.className = 'card history-card';
    card.dataset.month = record.month;
    const main = document.createElement('div');
    main.className = 'history-main';
    const title = document.createElement('h2');
    title.textContent = monthLabel(record.month);
    const metrics = document.createElement('div');
    metrics.className = 'history-metrics';
    const revenue = document.createElement('span');
    revenue.append('销售净收入 ', Object.assign(document.createElement('strong'), { textContent: `${formatAmount(result.netRevenue)} 元` }));
    const profit = document.createElement('span');
    const profitValue = Object.assign(document.createElement('strong'), { textContent: `${formatAmount(result.operatingProfit)} 元` });
    if (result.operatingProfit < 0) profitValue.className = 'negative-text';
    profit.append('最终经营利润 ', profitValue);
    metrics.append(revenue, profit);
    main.append(title, metrics);
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    actions.append(
      createHistoryButton('查看', () => routeTo('result', record.month)),
      createHistoryButton('修改', () => routeTo('entry', record.month)),
      createHistoryButton('删除', () => deleteMonth(record.month), true)
    );
    card.append(main, actions);
    list.append(card);
  });
}

function renderRoute() {
  const route = readRoute();
  if (route.name === 'home') {
    showView('home');
    renderHome(route.month || activeMonth);
  } else if (route.name === 'entry') {
    showView('entry');
    activeMonth = route.month || activeMonth || currentMonth();
    populateForm(activeMonth);
  } else if (route.name === 'result') {
    if (renderResult(route.month)) showView('result');
  } else {
    showView('history');
    renderHistory();
  }
}

createMoneyFields(byId('direct-fields'), DIRECT_EXPENSE_FIELDS);
createMoneyFields(byId('fixed-fields'), FIXED_EXPENSE_FIELDS);

byId('brand-home').addEventListener('click', () => routeTo('home', activeMonth));
byId('header-history').addEventListener('click', () => routeTo('history'));
byId('home-month').addEventListener('change', (event) => {
  activeMonth = event.target.value || currentMonth();
  routeTo('home', activeMonth);
});
byId('home-create').addEventListener('click', () => routeTo('entry', activeMonth));
byId('home-edit').addEventListener('click', () => routeTo('entry', activeMonth));
byId('home-view-result').addEventListener('click', () => routeTo('result', activeMonth));
byId('home-history').addEventListener('click', () => routeTo('history'));
byId('history-create').addEventListener('click', () => routeTo('entry', activeMonth));
byId('history-add').addEventListener('click', () => routeTo('entry', currentMonth()));
document.querySelectorAll('[data-go-home]').forEach((button) => button.addEventListener('click', () => routeTo('home', activeMonth)));
form.querySelectorAll('input[name="costMode"]').forEach((input) => input.addEventListener('change', toggleCostMode));
form.addEventListener('input', updateLiveResult);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = readForm();
  const result = calculate(values);
  const errorBox = byId('form-errors');
  if (!result.valid) {
    errorBox.textContent = result.errors.join('；');
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  try {
    storage.saveMonthlyRecord(values);
    activeMonth = result.normalized.month;
    errorBox.hidden = true;
    setStatus(`${monthLabel(activeMonth)} 已保存`);
    routeTo('result', activeMonth);
  } catch (error) {
    errorBox.textContent = `保存失败：${error.message || '浏览器本地存储不可用'}`;
    errorBox.hidden = false;
  }
});
byId('result-edit').addEventListener('click', () => routeTo('entry', activeMonth));
byId('result-delete').addEventListener('click', () => deleteMonth(activeMonth, 'home'));
window.addEventListener('hashchange', renderRoute);

if (!window.location.hash) history.replaceState(null, '', '#home');
renderRoute();
window.__LEDGER_APP_READY__ = true;
