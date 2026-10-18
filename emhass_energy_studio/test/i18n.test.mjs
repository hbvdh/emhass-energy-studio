import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {detectLanguage, resolveLanguage, normalizeLanguageTag, messages, t} from '../public/i18n.js';
import {normalizePlan, validateRun} from '../public/data.js';

test('language detection reads Home Assistant locale before browser locale', () => {
  const parent = {document: {querySelector: () => ({hass: {locale: {language: 'en-GB'}}})}};
  assert.equal(detectLanguage(parent, {language:'nl-NL'}), 'en');
  parent.document.querySelector = () => ({hass:{locale:{language:'nl-NL'}}});
  assert.equal(detectLanguage(parent, {language:'en-US'}), 'nl');
});

test('browser language fallback works when parent cannot be accessed', () => {
  const blocked = {get document() {throw new Error('SecurityError');}};
  assert.equal(detectLanguage(blocked,{languages:['nl-BE','en-US'],language:'en-US'}),'nl');
  assert.equal(detectLanguage(blocked,{languages:['en-US']}),'en');
  assert.equal(detectLanguage(null,{language:'de-DE'}),'en');
  assert.equal(normalizeLanguageTag('NL_nl'),'nl');
});

test('Dutch and English share the same complete translation dictionary', () => {
  const dutch = Object.keys(messages.nl).sort();
  const english = Object.keys(messages.en).sort();
  assert.deepEqual(english,dutch);
  for (const key of dutch) {
    assert.ok(messages.nl[key].length>0,`missing Dutch ${key}`);
    assert.ok(messages.en[key].length>0,`missing English ${key}`);
  }
  assert.equal(t('en','kpi.today'),'Net energy cost today');
  assert.equal(t('nl','kpi.today'),'Netto energiekosten vandaag');
  assert.match(t('en','status.ageMinutes',{minutes:20}),/20 min ago/);
});

test('All marked HTML translations exist in both languages', () => {
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const keys=[...html.matchAll(/data-i18n(?:-(?:aria|title|placeholder|content))?="([\w.]+)"/g)].map(m=>m[1]);
  assert.ok(keys.length>=70);
  for (const key of keys) {
    assert.ok(messages.nl[key]!==undefined,`Missing NL translation ${key}`);
    assert.ok(messages.en[key]!==undefined,`Missing EN translation ${key}`);
  }
});

test('Live EMHASS warnings and parsing errors can be displayed in English', () => {
  assert.throws(()=>normalizePlan({status:'no-run'},'en'),/No usable optimization plan/);
  const plan={generated_at:'2026-10-17T09:00:00Z',emhass_schema_version:'1.0'};
  const run={status:'infeasible',timestamp:'2026-10-17T09:15:00Z',infeasible:true};
  const warnings=validateRun(plan,run,new Date('2026-10-17T10:00:00Z'),'en');
  assert.ok(warnings.some(text=>text.includes('60 minutes old')));
  assert.ok(warnings.some(text=>text.includes('infeasible')));
});

test('add-on language overrides browser and HA, auto follows HA then browser', () => {
  const parent = {document: {querySelector: () => ({hass:{locale:{language:'nl-NL'}}})}};
  const englishBrowser = {language:'en-GB'};
  assert.equal(resolveLanguage('en',parent,englishBrowser),'en');
  assert.equal(resolveLanguage('nl',parent,englishBrowser),'nl');
  assert.equal(resolveLanguage('auto',parent,englishBrowser),'nl');
  const blocked = {get document() {throw new Error('SecurityError');}};
  assert.equal(resolveLanguage('auto',blocked,englishBrowser),'en');
  assert.equal(resolveLanguage('unsupported',blocked,{language:'nl-NL'}),'nl');
});
