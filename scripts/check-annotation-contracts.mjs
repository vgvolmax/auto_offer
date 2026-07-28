import { spawnSync } from 'node:child_process';
import { loadAnnotationSchemas } from './lib/annotation-schema-loader.mjs';

const generated = spawnSync(process.execPath, ['scripts/generate-annotation-dispatchers.mjs'], { stdio: 'inherit' });
if (generated.status) process.exit(generated.status);
const diff = spawnSync('git', ['diff', '--exit-code', '--', 'schemas/annotation/generated'], { stdio: 'inherit' });
if (diff.status) throw new Error('Generated annotation dispatchers are stale');
const { documents, productionIds } = await loadAnnotationSchemas();
console.log(`Compiled ${documents.length} Draft 2020-12 schemas, including ${productionIds.length} production entry points.`);
