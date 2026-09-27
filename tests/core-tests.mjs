import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculate } from '../site/assets/calculator.js';
import { createLedgerStorage } from '../site/assets/storage.js';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const originalCalculator = require(path.resolve(here, '../../SMALL_SELLER_PROFIT_LEDGER/miniprogram/utils/calculator.js'));

function baseline(month = '2026-09') {
  return {
    month,
    costMode: 'simple',
    salesRevenue: 100000,
    refunds: 0,
    otherIncome: 0,
    totalOrders: 1000,
    simpleGoodsCost: 40000,
    packaging: 0,
    shipping: 10000,
    platformFee: 10000,
    ads: 10000,
    employeeWages: 10000,
    rent: 8000
  };
}

function fakeLocalStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test('TEST 1 普通简单成本模式完整计算', () => {
  const result = calculate(baseline());
  assert.equal(result.valid, true);
  assert.equal(result.netRevenue, 100000);
  assert.equal(result.goodsCost, 40000);
  assert.equal(result.grossProfit, 60000);
  assert.equal(result.grossMargin, 0.6);
  assert.equal(result.directExpenses, 30000);
  assert.equal(result.contributionProfit, 30000);
  assert.equal(result.contributionMargin, 0.3);
  assert.equal(result.fixedExpenses, 18000);
  assert.equal(result.operatingProfit, 12000);
  assert.equal(result.netMargin, 0.12);
  assert.equal(result.averageOrderRevenue, 100);
  assert.equal(result.averageOrderProfit, 12);
  assert.equal(result.breakEvenRevenue, 60000);
  assert.equal(result.breakEvenDifference, 40000);
});

test('TEST 2 库存模式正确计算', () => {
  const input = baseline();
  Object.assign(input, { costMode: 'inventory', simpleGoodsCost: 999999, openingInventory: 50000, purchases: 20000, closingInventory: 30000 });
  const result = calculate(input);
  assert.equal(result.valid, true);
  assert.equal(result.goodsCost, 40000);
});

test('TEST 3 销售净收入为 0 不除零', () => {
  const input = baseline();
  Object.assign(input, { salesRevenue: 0, refunds: 0, otherIncome: 0 });
  const result = calculate(input);
  assert.equal(result.grossMargin, null);
  assert.equal(result.contributionMargin, null);
  assert.equal(result.netMargin, null);
  assert.equal(result.breakEvenRevenue, null);
  assert.equal(result.breakEvenReason, 'ZERO_NET_REVENUE');
  assert.equal(/NaN|Infinity/.test(JSON.stringify(result)), false);
});

test('TEST 4 订单量为 0 不计算平均指标', () => {
  const result = calculate({ ...baseline(), totalOrders: 0 });
  assert.equal(result.averageOrderRevenue, null);
  assert.equal(result.averageOrderProfit, null);
});

test('TEST 5 非正贡献不生成伪保本额', () => {
  const result = calculate({ ...baseline(), simpleGoodsCost: 70000 });
  assert.equal(result.contributionProfit, 0);
  assert.equal(result.breakEvenRevenue, null);
  assert.equal(result.breakEvenReason, 'NON_POSITIVE_CONTRIBUTION');
});

test('TEST 6 负商品成本库存数据被阻止', () => {
  const result = calculate({ ...baseline(), costMode: 'inventory', openingInventory: 1000, purchases: 500, closingInventory: 2000 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('；'), /期初库存加本月采购不能小于期末库存/);
});

test('TEST 7 保存后重建存储实例仍可读取', () => {
  const api = fakeLocalStorage();
  createLedgerStorage(api).saveMonthlyRecord(baseline('2026-07'));
  const reopened = createLedgerStorage(api).getMonthlyRecord('2026-07');
  assert.ok(reopened);
  assert.equal(calculate(reopened.input).operatingProfit, 12000);
});

test('TEST 8 修改同月覆盖旧结果', () => {
  const store = createLedgerStorage(fakeLocalStorage());
  store.saveMonthlyRecord(baseline('2026-08'));
  store.saveMonthlyRecord({ ...baseline('2026-08'), rent: 10000 });
  assert.equal(store.listMonthlyRecords().length, 1);
  assert.equal(calculate(store.getMonthlyRecord('2026-08').input).operatingProfit, 10000);
});

test('TEST 9 确认后删除月份', () => {
  const store = createLedgerStorage(fakeLocalStorage());
  store.saveMonthlyRecord(baseline('2026-06'));
  const simulatedConfirmation = true;
  if (simulatedConfirmation) store.deleteMonthlyRecord('2026-06');
  assert.equal(store.getMonthlyRecord('2026-06'), null);
});

test('TEST 10 两个月份互不覆盖', () => {
  const store = createLedgerStorage(fakeLocalStorage());
  store.saveMonthlyRecord(baseline('2026-05'));
  store.saveMonthlyRecord({ ...baseline('2026-06'), salesRevenue: 80000 });
  const records = store.listMonthlyRecords();
  assert.deepEqual(records.map((item) => item.month), ['2026-06', '2026-05']);
  assert.equal(calculate(records[0].input).netRevenue, 80000);
  assert.equal(calculate(records[1].input).netRevenue, 100000);
});

test('EXTRA 非数字、Infinity 与负金额被阻止', () => {
  const result = calculate({ ...baseline(), salesRevenue: '不是数字', ads: Infinity, rent: -1 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('；'), /销售收入必须是有效数字/);
  assert.match(result.errors.join('；'), /广告推广必须是有效数字/);
  assert.match(result.errors.join('；'), /房租不能小于 0/);
});

test('PARITY H5 与现有小程序计算输出逐字段一致', () => {
  const cases = [
    baseline(),
    { ...baseline(), costMode: 'inventory', openingInventory: 50000, purchases: 20000, closingInventory: 30000 },
    { ...baseline(), salesRevenue: 0, simpleGoodsCost: 0 },
    { ...baseline(), totalOrders: 0 },
    { ...baseline(), simpleGoodsCost: 70000 }
  ];
  cases.forEach((input) => assert.deepEqual(calculate(input), originalCalculator.calculate(input)));
});

let passed = 0;
for (const item of tests) {
  try {
    await item.run();
    passed += 1;
    console.log(`PASS ${item.name}`);
  } catch (error) {
    console.error(`FAIL ${item.name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}
console.log(`\nCORE_RESULT ${passed}/${tests.length} PASSED`);
if (passed !== tests.length) process.exitCode = 1;
