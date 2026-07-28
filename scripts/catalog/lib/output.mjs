import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalStringify } from './canonical-json.mjs';

export async function writeText(filePath, value) {
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

export async function writeCanonicalJson(filePath, value) {
  await writeText(filePath, canonicalStringify(value, 2));
}

export async function writeCanonicalJsonl(filePath, values) {
  await writeText(filePath, values.map(value => canonicalStringify(value)).join('\n'));
}
