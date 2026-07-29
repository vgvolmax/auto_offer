import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
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

export async function writeCanonicalGzip(filePath, value) {
  const text = `${canonicalStringify(value, 2)}\n`;
  const compressed = gzipSync(Buffer.from(text, 'utf8'), {mtime: 0});
  await mkdir(path.dirname(filePath), {recursive: true});
  await writeFile(filePath, compressed);
  return {
    compressed_sha256: createHash('sha256').update(compressed).digest('hex'),
    uncompressed_sha256: createHash('sha256').update(text).digest('hex'),
    uncompressed_bytes: Buffer.byteLength(text)
  };
}
