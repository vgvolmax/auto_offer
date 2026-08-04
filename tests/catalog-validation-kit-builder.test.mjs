import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildCatalogValidationKitBuilderHtml,
} from '../scripts/catalog-validation-kit/generate-catalog-validation-kit-builder.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('builder is one deterministic offline HTML file', async () => {
  const first = await buildCatalogValidationKitBuilderHtml({ root });
  const second = await buildCatalogValidationKitBuilderHtml({ root });
  assert.equal(first, second);
  assert.match(first, /^<!doctype html>/i);
  assert.match(first, /<script>[^]*<\/script>/i);
  assert.doesNotMatch(first, /<script[^>]+src=/i);
  assert.doesNotMatch(first, /<link[^>]+href=/i);
  assert.doesNotMatch(first, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.doesNotMatch(first, /navigator\.sendBeacon|new\s+Worker\s*\(\s*['"]https?:/i);
});

test('builder exposes the complete Russian operator flow and safety limits', async () => {
  const html = await buildCatalogValidationKitBuilderHtml({ root });
  for (const text of [
    'Сборщик catalog-validation-kit.mjs',
    'Перетащите файлы',
    'Выбрать файлы',
    'Проверить комплект',
    'Собрать и скачать MJS',
    'Скачать диагностику',
    'Роль',
    'Файл',
    'Статус',
    '50 МиБ',
    '150 МиБ',
  ]) assert.ok(html.includes(text), `Missing UI text: ${text}`);
  assert.match(html, /MAX_FILE_BYTES\s*=\s*50\s*\*\s*1024\s*\*\s*1024/);
  assert.match(html, /MAX_TOTAL_BYTES\s*=\s*150\s*\*\s*1024\s*\*\s*1024/);
});

test('builder uses shared preflight/generation code and performs smoke validation before download', async () => {
  const html = await buildCatalogValidationKitBuilderHtml({ root });
  for (const marker of [
    'classifyCatalogValidationInputs',
    'preflightCatalogValidationInputs',
    'buildCatalogValidationKit',
    'validateCatalogBundle',
    'BUNDLE_SCHEMA_INVALID',
    'MISSING_EVIDENCE',
    'catalog-validation-kit.mjs',
    'catalog-validation-kit-diagnostics.json',
  ]) assert.ok(html.includes(marker), `Missing builder marker: ${marker}`);
  assert.match(html, /buildButton\.disabled\s*=\s*!state\.preflight\?\.ok/);
});
