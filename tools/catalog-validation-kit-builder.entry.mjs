import {
  catalogValidationInputRoles,
  classifyCatalogValidationInputs,
  preflightCatalogValidationInputs,
} from '../scripts/catalog-validation-kit/lib/input-contract.mjs';
import { buildCatalogValidationKit } from '../scripts/catalog-validation-kit/lib/generation-core.mjs';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const SMOKE_TIMEOUT_MS = 30_000;
const AJV_RUNTIME_SOURCE = decodeText(__CATALOG_AJV_RUNTIME_BASE64__);
const SMOKE_FIXTURE = __CATALOG_SMOKE_FIXTURE__;
const SMOKE_WORKER_SOURCE = `
self.onmessage = async event => {
  const { source, fixture } = event.data;
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    const module = await import(moduleUrl);
    const valid = await module.validateCatalogBundle(structuredClone(fixture));
    if (!valid.valid) throw new Error('Smoke fixture was rejected by generated validator');

    const structural = structuredClone(fixture);
    structural.extra = true;
    const structuralResult = await module.validateCatalogBundle(structural);
    if (!structuralResult.errors.some(item => item.code === 'BUNDLE_SCHEMA_INVALID')) {
      throw new Error('Structural smoke mutation was not detected');
    }

    const semantic = structuredClone(fixture);
    semantic.items[0].catalog_item.annotation.evidence = [];
    const semanticResult = await module.validateCatalogBundle(semantic);
    if (!semanticResult.errors.some(item => item.code === 'MISSING_EVIDENCE')) {
      throw new Error('Semantic smoke mutation was not detected');
    }
    self.postMessage({
      ok: true,
      result: { valid: true, checks: ['valid_fixture', 'BUNDLE_SCHEMA_INVALID', 'MISSING_EVIDENCE'] },
    });
  } catch (cause) {
    self.postMessage({
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
};
`;

const state = {
  files: [],
  classified: null,
  preflight: null,
  build: null,
  diagnostics: { errors: [], warnings: [] },
};

const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const checkButton = document.querySelector('#check-button');
const buildButton = document.querySelector('#build-button');
const diagnosticsButton = document.querySelector('#diagnostics-button');
const roleBody = document.querySelector('#role-body');
const summary = document.querySelector('#summary');
const diagnostics = document.querySelector('#diagnostics');

function decodeText(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sizeLabel(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} МиБ`;
}

function setDiagnostics(errors = [], warnings = []) {
  state.diagnostics = { errors, warnings };
  const rows = [
    ...errors.map(item => ({ level: 'Ошибка', ...item })),
    ...warnings.map(item => ({ level: 'Предупреждение', ...item })),
  ];
  diagnostics.textContent = rows.length
    ? rows.map(item => `${item.level} · ${item.code ?? 'BUILDER'} · ${item.path ?? '/'} · ${item.message}`).join('\n')
    : 'Ошибок и предупреждений нет.';
  diagnosticsButton.disabled = rows.length === 0 && !state.build;
}

function renderRoles() {
  roleBody.replaceChildren();
  for (const [role, definition] of Object.entries(catalogValidationInputRoles)) {
    const matches = state.classified?.candidates?.[role] ?? [];
    const row = document.createElement('tr');
    const status = matches.length === 1 ? 'Готово' : matches.length > 1 ? 'Дубликат' : 'Не найден';
    const filename = matches.map(item => item.name).join(', ') || `Ожидается ${definition.conventionalName}`;
    for (const value of [role, filename, status]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    row.dataset.status = status;
    roleBody.append(row);
  }
}

function analyze() {
  state.classified = classifyCatalogValidationInputs(state.files);
  state.preflight = preflightCatalogValidationInputs(state.classified);
  renderRoles();
  buildButton.disabled = !state.preflight?.ok;
  if (state.preflight.ok) {
    const info = state.preflight.summary;
    summary.textContent = `Комплект готов: taxonomy ${info.taxonomy_version}, классов ${info.class_count}, схем ${info.schema_count}, модулей ${info.module_count}.`;
    setDiagnostics([], state.preflight.warnings);
  } else {
    summary.textContent = 'Комплект пока нельзя собрать. Исправьте ошибки ниже.';
    setDiagnostics(state.preflight.errors, state.preflight.warnings);
  }
}

async function acceptFiles(selected) {
  const files = [...selected];
  const tooLarge = files.filter(file => file.size > MAX_FILE_BYTES);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (tooLarge.length || total > MAX_TOTAL_BYTES) {
    state.files = [];
    state.classified = null;
    state.preflight = null;
    buildButton.disabled = true;
    renderRoles();
    const errors = [];
    for (const file of tooLarge) errors.push({
      code: 'FILE_TOO_LARGE',
      path: `/files/${file.name}`,
      message: `${file.name}: ${sizeLabel(file.size)}; максимум 50 МиБ`,
    });
    if (total > MAX_TOTAL_BYTES) errors.push({
      code: 'TOTAL_SIZE_EXCEEDED',
      path: '/files',
      message: `Общий размер ${sizeLabel(total)}; максимум 150 МиБ`,
    });
    setDiagnostics(errors, []);
    summary.textContent = 'Файлы не загружены из-за ограничения размера.';
    return;
  }
  state.files = await Promise.all(files.map(async file => ({
    name: file.name,
    text: await file.text(),
    size: file.size,
  })));
  state.build = null;
  analyze();
}

async function smokeTest(source) {
  const workerUrl = URL.createObjectURL(new Blob([SMOKE_WORKER_SOURCE], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl, { type: 'module', name: 'catalog-validation-kit-smoke' });
  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Smoke-test timed out')), SMOKE_TIMEOUT_MS);
      worker.onmessage = event => {
        clearTimeout(timeout);
        if (event.data?.ok) resolve(event.data.result);
        else reject(new Error(event.data?.error ?? 'Smoke-test failed'));
      };
      worker.onerror = event => {
        clearTimeout(timeout);
        reject(new Error(event.message || 'Smoke-test worker failed'));
      };
      worker.postMessage({ source, fixture: SMOKE_FIXTURE });
    });
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }
}

fileInput.addEventListener('change', event => acceptFiles(event.target.files));
checkButton.addEventListener('click', analyze);
for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.dataset.active = 'true';
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    delete dropZone.dataset.active;
  });
}
dropZone.addEventListener('drop', event => acceptFiles(event.dataTransfer.files));
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') fileInput.click();
});

buildButton.addEventListener('click', async () => {
  buildButton.disabled = true;
  summary.textContent = 'Собираю автономный валидатор и выполняю smoke-test…';
  try {
    const result = await buildCatalogValidationKit(state.files, { ajvRuntimeSource: AJV_RUNTIME_SOURCE });
    const smoke = await smokeTest(result.source);
    state.build = { ...result, smoke };
    summary.textContent = `Готово: ${sizeLabel(result.bytes)}, SHA-256 ${result.sha256}.`;
    setDiagnostics([], state.preflight.warnings);
    download('catalog-validation-kit.mjs', result.source, 'text/javascript;charset=utf-8');
  } catch (cause) {
    const details = cause?.diagnostics?.errors ?? [{
      code: 'BUILD_FAILED',
      path: '/build',
      message: cause instanceof Error ? cause.message : String(cause),
    }];
    summary.textContent = 'Сборка не завершена.';
    setDiagnostics(details, cause?.diagnostics?.warnings ?? []);
  } finally {
    buildButton.disabled = !state.preflight?.ok;
  }
});

diagnosticsButton.addEventListener('click', () => {
  download('catalog-validation-kit-diagnostics.json', `${JSON.stringify({
    generated_at: new Date().toISOString(),
    preflight: state.preflight,
    build: state.build ? {
      bytes: state.build.bytes,
      sha256: state.build.sha256,
      metadata: state.build.metadata,
      smoke: state.build.smoke,
    } : null,
    diagnostics: state.diagnostics,
  }, null, 2)}\n`, 'application/json;charset=utf-8');
});

renderRoles();
setDiagnostics([], []);
