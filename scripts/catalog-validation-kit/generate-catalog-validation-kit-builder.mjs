import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build as viteBuild } from 'vite';
import { buildCatalogAjvRuntimeSource } from './repository-inputs.mjs';

function buildOutputs(result) {
  const builds = Array.isArray(result) ? result : [result];
  return builds.flatMap(build => build.output ?? []);
}

function htmlDocument(script) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src blob:">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Сборщик catalog-validation-kit.mjs</title>
  <!-- MAX_FILE_BYTES = 50 * 1024 * 1024; MAX_TOTAL_BYTES = 150 * 1024 * 1024 -->
  <style>
    :root { color-scheme: light; font-family: Inter, Segoe UI, Arial, sans-serif; background:#f3f5f8; color:#172033; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; }
    main { width:min(1040px,calc(100% - 32px)); margin:32px auto; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); }
    .lead { margin:0 0 24px; color:#536079; line-height:1.55; }
    .panel { background:white; border:1px solid #d9dfeb; border-radius:16px; padding:20px; margin-bottom:18px; box-shadow:0 8px 28px rgba(24,39,75,.06); }
    #drop-zone { border:2px dashed #8aa0c4; border-radius:14px; min-height:170px; display:grid; place-items:center; text-align:center; padding:24px; cursor:pointer; transition:.15s ease; }
    #drop-zone[data-active="true"] { border-color:#245bc4; background:#f0f5ff; transform:translateY(-1px); }
    #drop-zone strong { display:block; font-size:20px; margin-bottom:8px; }
    .muted { color:#66738a; }
    .limits { display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; font-size:14px; color:#536079; }
    .limits span { padding:5px 9px; background:#eef2f8; border-radius:999px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }
    button { appearance:none; border:1px solid #9aabc7; background:white; color:#172033; border-radius:10px; padding:10px 15px; font:inherit; font-weight:650; cursor:pointer; }
    button.primary { background:#245bc4; border-color:#245bc4; color:white; }
    button:disabled { opacity:.45; cursor:not-allowed; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th,td { text-align:left; padding:10px 8px; border-bottom:1px solid #e4e8f0; vertical-align:top; }
    th { color:#536079; font-size:13px; text-transform:uppercase; letter-spacing:.04em; }
    tr[data-status="Готово"] td:last-child { color:#18794e; font-weight:700; }
    tr[data-status="Дубликат"] td:last-child,tr[data-status="Не найден"] td:last-child { color:#b42318; font-weight:700; }
    #summary { font-weight:650; line-height:1.5; }
    pre { margin:12px 0 0; padding:14px; max-height:300px; overflow:auto; white-space:pre-wrap; background:#111827; color:#e5edf8; border-radius:10px; font:13px/1.5 Consolas,monospace; }
    input[type="file"] { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
  </style>
</head>
<body>
  <main>
    <h1>Сборщик catalog-validation-kit.mjs</h1>
    <p class="lead">Собирает автономный валидатор из актуального annotation kit, registry и семантических модулей. Работает локально: файлы не отправляются в сеть.</p>

    <section class="panel">
      <div id="drop-zone" role="button" tabindex="0" aria-controls="file-input">
        <div>
          <strong>Перетащите файлы сюда</strong>
          <span class="muted">или нажмите, чтобы выбрать их на компьютере</span>
          <div class="actions" style="justify-content:center"><button type="button">Выбрать файлы</button></div>
        </div>
      </div>
      <input id="file-input" type="file" multiple accept=".json,.mjs,.js,.txt">
      <div class="limits"><span>Не более 50 МиБ на файл</span><span>Не более 150 МиБ суммарно</span></div>
      <div class="actions">
        <button id="check-button" type="button">Проверить комплект</button>
        <button id="build-button" class="primary" type="button" disabled>Собрать и скачать MJS</button>
        <button id="diagnostics-button" type="button" disabled>Скачать диагностику</button>
      </div>
    </section>

    <section class="panel">
      <h2>Состав комплекта</h2>
      <table>
        <thead><tr><th>Роль</th><th>Файл</th><th>Статус</th></tr></thead>
        <tbody id="role-body"></tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Результат</h2>
      <div id="summary">Добавьте исходные файлы.</div>
      <pre id="diagnostics">Ошибок и предупреждений нет.</pre>
    </section>
  </main>
  <script>${script}</script>
</body>
</html>
`;
}

export async function buildCatalogValidationKitBuilderHtml({ root = '.' } = {}) {
  const absoluteRoot = path.resolve(root);
  const [ajvRuntimeSource, smokeFixture] = await Promise.all([
    buildCatalogAjvRuntimeSource(),
    readFile(path.join(absoluteRoot, 'tests/fixtures/bundles/catalog.valid.json'), 'utf8').then(JSON.parse),
  ]);
  const result = await viteBuild({
    configFile: false,
    root: absoluteRoot,
    logLevel: 'silent',
    define: {
      __CATALOG_AJV_RUNTIME_BASE64__: JSON.stringify(Buffer.from(ajvRuntimeSource).toString('base64')),
      __CATALOG_SMOKE_FIXTURE__: JSON.stringify(smokeFixture),
    },
    build: {
      write: false,
      target: 'es2022',
      minify: false,
      sourcemap: false,
      rollupOptions: {
        input: path.join(absoluteRoot, 'tools/catalog-validation-kit-builder.entry.mjs'),
        output: {
          format: 'iife',
          inlineDynamicImports: true,
          entryFileNames: 'catalog-validation-kit-builder.js',
        },
      },
    },
  });
  const chunks = buildOutputs(result).filter(output => output.type === 'chunk');
  const assets = buildOutputs(result).filter(output => output.type === 'asset');
  if (chunks.length !== 1 || assets.length !== 0) {
    throw new Error(`Offline builder must emit one script and no assets; chunks=${chunks.length}, assets=${assets.length}`);
  }
  const script = chunks[0].code.trim();
  if (/\bfrom\s+['"]|\bimport\s+['"]/.test(script)) throw new Error('Offline builder contains a static external import');
  return htmlDocument(script);
}

export async function generateCatalogValidationKitBuilder({ root = '.', output } = {}) {
  const absoluteRoot = path.resolve(root);
  const target = output ? path.resolve(output) : path.join(absoluteRoot, 'tools/catalog-validation-kit-builder.html');
  const html = await buildCatalogValidationKitBuilderHtml({ root: absoluteRoot });
  await writeFile(target, html, 'utf8');
  return { path: target, bytes: Buffer.byteLength(html) };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const result = await generateCatalogValidationKitBuilder();
  console.log(`Generated ${result.path} (${result.bytes} bytes).`);
}
