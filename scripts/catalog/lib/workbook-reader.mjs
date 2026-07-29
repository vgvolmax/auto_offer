import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readZipEntries } from './zip-reader.mjs';
import { attributes, collectTagTexts, decodeXml } from './xml.mjs';

const textDecoder = new TextDecoder('utf-8');

function xml(entries, name, optional = false) {
  const data = entries.get(name);
  if (!data) {
    if (optional) return null;
    throw new Error(`OOXML_PART_NOT_FOUND:${name}`);
  }
  return textDecoder.decode(data);
}

function normalizePart(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  return path.posix.normalize(path.posix.join(base, target));
}

function parseRelationships(value, base) {
  const map = new Map();
  for (const match of value.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    const attrs = attributes(match[1]);
    if (attrs.Id && attrs.Target) map.set(attrs.Id, normalizePart(base, attrs.Target));
  }
  return map;
}

function parseSharedStrings(value) {
  if (!value) return [];
  const result = [];
  for (const match of value.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) result.push(collectTagTexts(match[1], 't').join(''));
  return result;
}

function parseStyles(value) {
  if (!value) return [];
  const formats = new Map();
  for (const match of value.matchAll(/<numFmt\b([^>]*)\/?\s*>/g)) {
    const attrs = attributes(match[1]);
    formats.set(Number(attrs.numFmtId), attrs.formatCode ?? '');
  }
  const xfsSection = value.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
  const styles = [];
  for (const match of xfsSection.matchAll(/<xf\b([^>]*)\/?\s*>/g)) {
    const attrs = attributes(match[1]);
    styles.push(formats.get(Number(attrs.numFmtId)) ?? '');
  }
  return styles;
}

function formatNumeric(raw, formatCode) {
  if (!formatCode) return raw;
  const cleaned = formatCode.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '').split(';')[0];
  if (/^0+$/.test(cleaned) && /^-?\d+(?:\.0+)?$/.test(raw)) {
    const integer = raw.replace(/\.0+$/, '').replace(/^-/, '');
    return `${raw.startsWith('-') ? '-' : ''}${integer.padStart(cleaned.length, '0')}`;
  }
  return raw;
}

function columnOf(reference) {
  return reference.match(/^[A-Z]+/)?.[0] ?? reference;
}

function parseCell(fragment, sharedStrings, styles) {
  const open = fragment.match(/^<c\b([^>]*)>/)?.[1] ?? fragment.match(/^<c\b([^>]*)\/>/)?.[1] ?? '';
  const attrs = attributes(open);
  const reference = attrs.r;
  const type = attrs.t ?? 'n';
  const styleIndex = attrs.s === undefined ? null : Number(attrs.s);
  const formulaMatch = fragment.match(/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/);
  const valueMatch = fragment.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);
  const inline = type === 'inlineStr' ? collectTagTexts(fragment, 't').join('') : null;
  const raw = valueMatch ? decodeXml(valueMatch[1]) : inline;
  let text = raw ?? '';
  if (type === 's' && raw !== null) text = sharedStrings[Number(raw)] ?? raw;
  else if (type === 'b') text = raw === '1' ? 'TRUE' : 'FALSE';
  else if (type === 'inlineStr') text = inline ?? '';
  else if (type === 'n' || !attrs.t) text = formatNumeric(raw ?? '', styles[styleIndex] ?? '');
  return {
    reference,
    column: columnOf(reference),
    type,
    style_index: styleIndex,
    raw_value: raw,
    text,
    formula: formulaMatch ? decodeXml(formulaMatch[1]) : null,
    formula_has_cached_value: formulaMatch ? Boolean(valueMatch) : null
  };
}

function parseSheet(value, metadata, sharedStrings, styles) {
  const dimension = attributes(value.match(/<dimension\b([^>]*)\/?\s*>/)?.[1] ?? '').ref ?? null;
  const mergedRanges = [...value.matchAll(/<mergeCell\b([^>]*)\/?\s*>/g)].map(match => attributes(match[1]).ref).filter(Boolean);
  const rows = [];
  let formulaCount = 0;
  let formulaWithoutCached = 0;
  let hiddenRowCount = 0;
  for (const match of value.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const attrs = attributes(match[1]);
    const cells = {};
    for (const cellMatch of match[2].matchAll(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)) {
      const cell = parseCell(cellMatch[0], sharedStrings, styles);
      if (!cell.reference) continue;
      cells[cell.column] = cell;
      if (cell.formula !== null) {
        formulaCount += 1;
        if (!cell.formula_has_cached_value) formulaWithoutCached += 1;
      }
    }
    if (Object.keys(cells).length) {
      const hidden = attrs.hidden === '1';
      if (hidden) hiddenRowCount += 1;
      rows.push({number: Number(attrs.r), hidden, cells});
    }
  }
  return {
    ...metadata,
    dimension,
    merged_ranges: mergedRanges,
    nonempty_row_count: rows.length,
    hidden_row_count: hiddenRowCount,
    formula_count: formulaCount,
    formula_without_cached_value_count: formulaWithoutCached,
    rows
  };
}

export async function readWorkbook(filePath) {
  const buffer = await readFile(filePath);
  const entries = readZipEntries(buffer);
  const workbookXml = xml(entries, 'xl/workbook.xml');
  const relationships = parseRelationships(xml(entries, 'xl/_rels/workbook.xml.rels'), 'xl');
  const sharedStrings = parseSharedStrings(xml(entries, 'xl/sharedStrings.xml', true));
  const styles = parseStyles(xml(entries, 'xl/styles.xml', true));
  const sheets = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/g)) {
    const attrs = attributes(match[1]);
    const part = relationships.get(attrs['r:id']);
    if (!part) throw new Error(`WORKSHEET_RELATIONSHIP_NOT_FOUND:${attrs.name}`);
    sheets.push(parseSheet(xml(entries, part), {
      name: attrs.name,
      state: attrs.state ?? 'visible',
      part
    }, sharedStrings, styles));
  }
  return {file_path: filePath, sheets};
}
