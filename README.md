# 小卖家真实利润账本 H5 V1-A

手机优先的纯静态 H5：选择月份、填写经营数据、查看三层利润与保本线，并在当前浏览器使用 `localStorage` 保存历史月份。

- GitHub 仓库：<https://github.com/mina426w-ux/small-seller-profit-ledger-h5>
- HTTPS 页面：<https://mina426w-ux.github.io/small-seller-profit-ledger-h5/>

## 与小程序版的关系

H5 计算器从以下已经通过 11/11 测试的小程序计算模块移植，保持字段、公式、边界分支和结果结构一致：

`D:\CODEX_WORKSPACE\SMALL_SELLER_PROFIT_LEDGER\miniprogram\utils\calculator.js`

核心测试中的 `PARITY` 会用五组输入对 H5 与小程序模块执行逐字段深度相等检查。原小程序项目不被修改。

## 本地运行

本项目无运行时依赖。用任意静态服务器打开 `site` 目录即可，例如：

```powershell
python -m http.server 4173 --directory D:\CODEX_WORKSPACE\SMALL_SELLER_PROFIT_LEDGER_H5\site
```

然后访问 `http://127.0.0.1:4173/`。

## 测试

```powershell
node tests/core-tests.mjs
$env:NODE_PATH='C:\Users\idasd\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tests/browser-e2e.mjs
```

浏览器测试会启动临时本地静态服务器，使用真实 Chromium 验证桌面端闭环和 390×844 手机视口。

## 数据范围

数据使用 `small_seller_profit_ledger_h5:v1:records` 保存于当前浏览器和设备。清理浏览器数据、更换浏览器或更换设备可能导致记录丢失。V1-A 不包含账号、云数据库、多设备同步、平台接口或复杂图表。
