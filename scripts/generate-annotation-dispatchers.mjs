import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('schemas/annotation');
const registry = JSON.parse(await readFile(path.join(root, 'class-schema-registry.json'), 'utf8'));
const seen = new Set();
for (const [classId, entry] of Object.entries(registry.classes)) {
  for (const kind of ['catalog', 'request']) {
    const rel = entry[`${kind}_schema`];
    if (!rel) throw new Error(`${classId} has no ${kind}_schema`);
    if (seen.has(rel)) throw new Error(`${rel} is registered more than once`);
    seen.add(rel); await access(path.join(root, rel));
    const schema = JSON.parse(await readFile(path.join(root, rel), 'utf8'));
    const consts = JSON.stringify(schema).match(/"class_id":\s*\{\s*"const":\s*"([^"]+)"/);
    if (!consts || consts[1] !== classId) throw new Error(`${rel} does not declare class_id const ${classId}`);
  }
}
for (const [kind, filename] of [['request','request-line.dispatch.schema.json'],['catalog','catalog-item.dispatch.schema.json']]) {
  const oneOf = Object.values(registry.classes).map(e => ({ $ref: `../${e[`${kind}_schema`]}` }));
  const schema = {$schema:'https://json-schema.org/draft/2020-12/schema',$id:`https://example.local/schemas/annotation/generated/${filename}`,title:`Generated ${kind} class dispatcher`,oneOf};
  await writeFile(path.join(root,'generated',filename), JSON.stringify(schema,null,2)+'\n');
}
