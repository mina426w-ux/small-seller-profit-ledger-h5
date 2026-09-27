// Browser-port of the verified V1-A calculator.
// Source reference: SMALL_SELLER_PROFIT_LEDGER/miniprogram/utils/calculator.js
const DIRECT_EXPENSE_FIELDS = [
  { key: 'packaging', label: '包装费用' },
  { key: 'shipping', label: '快递费用' },
  { key: 'platformFee', label: '平台佣金/扣点' },
  { key: 'ads', label: '广告推广' },
  { key: 'influencer', label: '达人佣金' },
  { key: 'paymentFee', label: '支付手续费' },
  { key: 'shippingInsurance', label: '运费险' },
  { key: 'returnsLoss', label: '退换货损失' },
  { key: 'afterSalesCompensation', label: '售后补偿' },
  { key: 'otherOrderExpense', label: '其他订单费用' }
];

const FIXED_EXPENSE_FIELDS = [
  { key: 'employeeWages', label: '员工工资' },
  { key: 'ownerLabor', label: '老板自己的人工成本' },
  { key: 'rent', label: '房租' },
  { key: 'warehousing', label: '仓储' },
  { key: 'water', label: '水费' },
  { key: 'electricity', label: '电费' },
  { key: 'internetPhone', label: '网络/电话' },
  { key: 'softwareSubscriptions', label: '软件订阅' },
  { key: 'equipment', label: '设备成本' },
  { key: 'officeSupplies', label: '办公用品' },
  { key: 'transportation', label: '交通' },
  { key: 'taxes', label: '税费' },
  { key: 'otherFixedExpense', label: '其他固定经营费用' }
];

const BASE_MONEY_FIELDS = [
  { key: 'salesRevenue', label: '销售收入' },
  { key: 'refunds', label: '退款金额' },
  { key: 'otherIncome', label: '其他经营收入' },
  { key: 'simpleGoodsCost', label: '本月已售商品成本' },
  { key: 'openingInventory', label: '期初库存' },
  { key: 'purchases', label: '本月采购' },
  { key: 'closingInventory', label: '期末库存' }
];

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readNonNegativeNumber(rawValue, label, errors) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) return 0;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    errors.push(`${label}必须是有效数字`);
    return 0;
  }
  if (value < 0) {
    errors.push(`${label}不能小于 0`);
    return 0;
  }
  return value;
}

function sumFields(input, definitions) {
  return roundMoney(definitions.reduce((sum, item) => sum + input[item.key], 0));
}

function calculate(rawInput) {
  const source = rawInput || {};
  const errors = [];
  const month = String(source.month || '');
  const costMode = source.costMode === 'inventory' ? 'inventory' : 'simple';

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) errors.push('请选择有效月份');

  const normalized = { month, costMode };
  const moneyFields = BASE_MONEY_FIELDS.concat(DIRECT_EXPENSE_FIELDS, FIXED_EXPENSE_FIELDS);
  moneyFields.forEach((item) => {
    normalized[item.key] = readNonNegativeNumber(source[item.key], item.label, errors);
  });

  const ordersRaw = source.totalOrders;
  if (ordersRaw === '' || ordersRaw === null || ordersRaw === undefined) {
    normalized.totalOrders = 0;
  } else {
    const orderCount = Number(ordersRaw);
    if (!Number.isFinite(orderCount) || orderCount < 0 || !Number.isInteger(orderCount)) {
      errors.push('总订单量必须是大于或等于 0 的整数');
      normalized.totalOrders = 0;
    } else {
      normalized.totalOrders = orderCount;
    }
  }

  if (
    costMode === 'inventory' &&
    normalized.openingInventory + normalized.purchases < normalized.closingInventory
  ) {
    errors.push('期初库存加本月采购不能小于期末库存，请检查库存数字');
  }

  if (errors.length) return { valid: false, errors, normalized };

  const netRevenue = roundMoney(normalized.salesRevenue - normalized.refunds + normalized.otherIncome);
  const goodsCost = costMode === 'inventory'
    ? roundMoney(normalized.openingInventory + normalized.purchases - normalized.closingInventory)
    : roundMoney(normalized.simpleGoodsCost);
  const grossProfit = roundMoney(netRevenue - goodsCost);
  const directExpenses = sumFields(normalized, DIRECT_EXPENSE_FIELDS);
  const contributionProfit = roundMoney(grossProfit - directExpenses);
  const fixedExpenses = sumFields(normalized, FIXED_EXPENSE_FIELDS);
  const operatingProfit = roundMoney(contributionProfit - fixedExpenses);

  const grossMargin = netRevenue === 0 ? null : grossProfit / netRevenue;
  const contributionMargin = netRevenue === 0 ? null : contributionProfit / netRevenue;
  const netMargin = netRevenue === 0 ? null : operatingProfit / netRevenue;
  const averageOrderRevenue = normalized.totalOrders > 0
    ? roundMoney(netRevenue / normalized.totalOrders)
    : null;
  const averageOrderProfit = normalized.totalOrders > 0
    ? roundMoney(operatingProfit / normalized.totalOrders)
    : null;

  let breakEvenRevenue = null;
  let breakEvenStatus = null;
  let breakEvenDifference = null;
  let breakEvenReason = null;

  if (netRevenue === 0) breakEvenReason = 'ZERO_NET_REVENUE';
  else if (netRevenue < 0) breakEvenReason = 'NON_POSITIVE_NET_REVENUE';
  else if (contributionMargin <= 0) breakEvenReason = 'NON_POSITIVE_CONTRIBUTION';
  else {
    breakEvenRevenue = roundMoney(fixedExpenses / contributionMargin);
    breakEvenDifference = roundMoney(Math.abs(netRevenue - breakEvenRevenue));
    if (netRevenue > breakEvenRevenue) breakEvenStatus = 'ABOVE';
    else if (netRevenue < breakEvenRevenue) breakEvenStatus = 'BELOW';
    else breakEvenStatus = 'AT';
  }

  const costBreakdown = [{ label: '商品成本', amount: goodsCost }]
    .concat(DIRECT_EXPENSE_FIELDS.map((item) => ({ label: item.label, amount: normalized[item.key] })))
    .concat(FIXED_EXPENSE_FIELDS.map((item) => ({ label: item.label, amount: normalized[item.key] })))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    valid: true,
    errors: [],
    normalized,
    netRevenue,
    goodsCost,
    grossProfit,
    grossMargin,
    directExpenses,
    contributionProfit,
    contributionMargin,
    fixedExpenses,
    operatingProfit,
    netMargin,
    averageOrderRevenue,
    averageOrderProfit,
    breakEvenRevenue,
    breakEvenStatus,
    breakEvenDifference,
    breakEvenReason,
    costBreakdown
  };
}

export {
  DIRECT_EXPENSE_FIELDS,
  FIXED_EXPENSE_FIELDS,
  calculate,
  roundMoney
};
