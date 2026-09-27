import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const site = path.join(root, 'site');
const required = [
  'index.html', 'favicon.svg', '.nojekyll',
  'assets/app.js', 'assets/calculator.js', 'assets/storage.js', 'assets/styles.css'
];

required.forEach((file) => assert.equal(fs.existsSync(path.join(site, file)), true, `缺少 ${file}`));

const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
['view-home', 'view-entry', 'view-result', 'view-history'].forEach((id) => {
  assert.match(html, new RegExp(`id=["']${id}["']`), `缺少页面 ${id}`);
});
assert.match(html, /name="viewport"/);
assert.match(html, /数据默认保存在当前浏览器和当前设备中/);

const app = fs.readFileSync(path.join(site, 'assets/app.js'), 'utf8');
const calculator = fs.readFileSync(path.join(site, 'assets/calculator.js'), 'utf8');
const storage = fs.readFileSync(path.join(site, 'assets/storage.js'), 'utf8');
const styles = fs.readFileSync(path.join(site, 'assets/styles.css'), 'utf8');
const combined = [html, app, calculator, storage, styles].join('\n');

assert.match(storage, /small_seller_profit_ledger_h5:v1:records/);
assert.match(styles, /overflow-x:\s*hidden/);
assert.match(styles, /@media\s*\(max-width:\s*720px\)/);
assert.doesNotMatch(combined, /fetch\s*\(|XMLHttpRequest|WebSocket|wx\.cloud|wx\.request|\bERP\b|\bCRM\b|\bMCP\b|Task Bus|\bBridge\b|淘宝|拼多多|抖音/i);
assert.doesNotMatch([html, app, calculator, storage, styles].join('\n'), /https?:\/\//i, '站点运行时不应依赖外部资源或 API');

console.log('PROJECT_VALIDATION_PASS');
console.log('views=4 siteFiles=7 externalRuntimeDependencies=0 forbiddenScopeMarkers=0');
