import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatEuroMetric} from '../public/money.js';

test('financial metrics in cents display as EUR with comma and two decimals',()=>{
  assert.equal(formatEuroMetric(448.2,'c'),'€ 4,48');
  assert.equal(formatEuroMetric(397,'ct'),'€ 3,97');
  assert.equal(formatEuroMetric(-51.2,'c'),'-€ 0,51');
  assert.equal(formatEuroMetric(34,'cent'),'€ 0,34');
  assert.equal(formatEuroMetric(0,'c'),'€ 0,00');
});
test('EUR units are not divided by 100; unknown currencies are not converted',()=>{
  assert.equal(formatEuroMetric(0.34,'EUR'),'€ 0,34');
  assert.equal(formatEuroMetric(1.02,'€'),'€ 1,02');
  assert.equal(formatEuroMetric(52,'pence'),null);
  assert.equal(formatEuroMetric(NaN,'c'),null);
});
test('introductory headline and body are gone, while status and actions remain',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html, /data-i18n="heroOne"|data-i18n="heroTwo"|data-i18n="intro"/);
  assert.match(html,/data-i18n="edition"/);
  assert.match(html,/id="refresh"/);
  assert.match(html,/id="live-pill"/);
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/formatEuroMetric\(value,unit\)/);
});
