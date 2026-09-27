# 小卖家真实利润账本 H5 V1-A｜测试与发布证据

验证日期：2026-09-28（Asia/Shanghai）

## 项目与发布

- 本地项目：`D:\CODEX_WORKSPACE\SMALL_SELLER_PROFIT_LEDGER_H5`
- 原小程序参考项目：`D:\CODEX_WORKSPACE\SMALL_SELLER_PROFIT_LEDGER`（未修改）
- GitHub：<https://github.com/mina426w-ux/small-seller-profit-ledger-h5>
- Pages：<https://mina426w-ux.github.io/small-seller-profit-ledger-h5/>
- 首个已验证站点 commit：`e8758c5d7081c38ee62e1c1fda5bb75342035a65`
- 成功 Actions run：[`36360219086`](https://github.com/mina426w-ux/small-seller-profit-ledger-h5/actions/runs/36360219086)，attempt 2，`completed / success`
- 成功 deployment：`6699604425`
- Pages：`build_type=workflow`、`https_enforced=true`、`public=true`
- 公网首页：HTTP 200，title 为“小卖家真实利润账本”

首次 workflow 在 Pages API 尚未建立站点时失败；启用 Pages 后，对相同 commit 重跑的 attempt 2 成功。最终状态以上述成功 run 和公网回读为准。

## 计算与存储核心

命令：`node tests/core-tests.mjs`

结果：`CORE_RESULT 12/12 PASSED`。

- 原 TEST 1–10 全部通过。
- 非法数字、`Infinity`、负金额测试通过。
- H5 与原小程序五组输入逐字段深度一致性测试通过。
- 基准结果：净收入 100000、商品毛利 60000、毛利率 60%、贡献利润 30000、贡献率 30%、最终经营利润 12000、净利率 12%、平均每单收入 100、平均每单利润 12、保本营业额 60000、超过保本线 40000。

## H5 本地浏览器

命令：`node tests/browser-e2e.mjs`（使用本机真实 Chrome 可执行文件）

结果：`H5_RESULT 7/7 PASSED`。

1. 桌面浏览器真实加载，无 JavaScript 错误和资源 4xx/5xx。
2. 基准案例完整填写和结果逐项一致。
3. 刷新后 `localStorage` 数据仍存在。
4. 关闭页面并重新打开后历史记录仍存在。
5. 修改已有月份后同月覆盖更新。
6. 删除确认中，取消保留、确认删除。
7. 390×844 手机视口：首页、结果页、录入页无横向滚动、按钮/输入框不溢出，触控控件尺寸满足测试阈值。

可见浏览器另行回读本地首页，标题、月份选择、填写入口、历史入口和本地存储提示均可见。

## 公网 HTTPS 浏览器回归

命令：设置 `H5_BASE_URL=https://mina426w-ux.github.io/small-seller-profit-ledger-h5/` 后运行 `node tests/browser-e2e.mjs`。

结果：同一套 `H5_RESULT 7/7 PASSED`。可见浏览器回读确认最终 URL 为 HTTPS Pages 地址，首页内容正常呈现。

## 静态结构

- `PROJECT_VALIDATION_PASS`
- 四个主要视图：首页、录入、结果、历史。
- 站点文件 7 个，共 43,914 bytes。
- 运行时外部依赖 0；禁止范围实现标记 0。
- JavaScript / MJS 语法检查：`SYNTAX_PASS 6 files`。

## 证据边界

- `CORE PASS`: `PASS`
- `INTEGRATION PASS`: `PASS`（本地及公网真实浏览器）
- `USER E2E PASS`: 未声明。仍需用户本人在真实手机浏览器使用。

## 截图

- `evidence\h5-local-desktop-result.png`
- `evidence\h5-local-mobile-entry.png`

截图为本地证据，不随公开仓库发布。
