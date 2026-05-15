export function decodeOsuFile(buffer: ArrayBuffer): string {
  const u8 = new Uint8Array(buffer);
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer);
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer);
  }
  let t = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (t.length > 0 && t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  if (!/\[HitObjects\]/i.test(t)) {
    const le = new TextDecoder('utf-16le').decode(buffer);
    if (/\[HitObjects\]/i.test(le)) return le;
  }
  return t;
}

export function splitOsuCsvPrefix(line: string, fieldCount: number): string[] {
  const out: string[] = [];
  let start = 0;
  for (let n = 0; n < fieldCount; n++) {
    const isLast = n === fieldCount - 1;
    if (isLast) {
      out.push(line.slice(start));
      break;
    }
    const idx = line.indexOf(',', start);
    if (idx === -1) {
      out.push(line.slice(start));
      while (out.length < fieldCount) out.push('');
      break;
    }
    out.push(line.slice(start, idx));
    start = idx + 1;
  }
  return out;
}
