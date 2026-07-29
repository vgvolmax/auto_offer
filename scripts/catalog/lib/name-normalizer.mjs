function cleanText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[×х✕]/g, 'x')
    .replace(/[“”„″]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s*([,;:])\s*/g, '$1 ')
    .trim();
}

export function normalizeName(value) {
  const name = cleanText(value);
  const tokens = [...name.matchAll(/[a-zа-я0-9]+(?:-[a-zа-я0-9]+)?|\d+\/\d+"/giu)].map(match => match[0]);
  let nameSkeleton = name
    .replace(/\bpn\s*\d+(?:[.,]\d+)?\b/giu, '<pn>')
    .replace(/\bdn\s*\d+(?:[.,]\d+)?\b/giu, '<dn>')
    .replace(/\b\d+(?:[.,]\d+)?x\d+\/\d+"/gu, '<diameter_mm>x<thread_inch>')
    .replace(/\b\d+\/\d+"/gu, '<thread_inch>')
    .replace(/\b\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?\b/gu, '<dimension_3d>')
    .replace(/\b\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?\b/gu, '<dimension_2d>')
    .replace(/\b\d+(?:[.,]\d+)?\s*мм\b/gu, '<length_mm>')
    .replace(/\b\d+(?:[.,]\d+)?\b/gu, '<number>');
  nameSkeleton = nameSkeleton.replace(/\s+/g, ' ').trim();
  return {name, name_skeleton: nameSkeleton, tokens};
}
