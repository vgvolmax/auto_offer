export function decodeXml(value = '') {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function attributes(fragment = '') {
  const result = {};
  for (const match of fragment.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) result[match[1]] = decodeXml(match[2]);
  return result;
}

export function tagText(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '')) : null;
}

export function collectTagTexts(xml, tag) {
  const values = [];
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g');
  for (const match of xml.matchAll(regex)) values.push(decodeXml(match[1].replace(/<[^>]+>/g, '')));
  return values;
}
