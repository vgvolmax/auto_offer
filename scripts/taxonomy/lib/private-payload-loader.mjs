import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (code, context) => { throw new Error(`${code}: ${context}`); };

export async function loadPrivateGzipJson({compactIndex, compactIndexName, filePath, expectedArtifactKind}) {
  const payload = compactIndex?.private_payload;
  const context = (expected = payload?.sha256, actual) => `compact index=${compactIndexName}; expected artifact kind=${expectedArtifactKind}; local file path=${filePath}; expected hash=${expected ?? '<missing>'}${actual ? `; actual hash=${actual}` : ''}`;
  if (payload?.committed !== false || payload?.artifact_kind !== expectedArtifactKind) fail('PRIVATE_PAYLOAD_ARTIFACT_KIND_MISMATCH', context(payload?.artifact_kind));
  let compressed;
  try { compressed = await readFile(filePath); } catch (error) { if (error.code === 'ENOENT') fail('PRIVATE_PAYLOAD_NOT_FOUND', context()); throw error; }
  const compressedSha256 = digest(compressed);
  if (compressedSha256 !== payload.sha256) fail('PRIVATE_PAYLOAD_SHA256_MISMATCH', context(payload.sha256, compressedSha256));
  let bytes;
  try { bytes = gunzipSync(compressed); } catch { fail('PRIVATE_PAYLOAD_INVALID_GZIP', context(payload.sha256, compressedSha256)); }
  const uncompressedSha256 = digest(bytes);
  if (uncompressedSha256 !== payload.uncompressed_sha256) fail('PRIVATE_PAYLOAD_UNCOMPRESSED_SHA256_MISMATCH', context(payload.uncompressed_sha256, uncompressedSha256));
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); } catch { fail('PRIVATE_PAYLOAD_INVALID_JSON', context(payload.uncompressed_sha256, uncompressedSha256)); }
  return {data, compressedSha256, uncompressedSha256};
}
