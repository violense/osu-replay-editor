export class BinaryStream {
  private offset = 0;
  private view: DataView;
  private uint8: Uint8Array;

  constructor(buffer: ArrayBuffer | number = 0) {
    const ab = typeof buffer === 'number' ? new ArrayBuffer(buffer) : buffer;
    this.view = new DataView(ab);
    this.uint8 = new Uint8Array(ab);
  }

  readByte() {
    return this.view.getUint8(this.offset++);
  }

  readShort() {
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }

  readInt() {
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  readLong() {
    const v = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return v;
  }

  readDouble() {
    const v = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return v;
  }

  readBytes(length: number) {
    const slice = this.uint8.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  readString(): string {
    if (this.readByte() !== 0x0b) return '';
    let len = 0;
    let shift = 0;
    for (;;) {
      const b = this.readByte();
      len |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    const str = new TextDecoder().decode(this.uint8.subarray(this.offset, this.offset + len));
    this.offset += len;
    return str;
  }

  getRemaining(): Uint8Array {
    return this.uint8.subarray(this.offset);
  }
}

export class BinaryWriter {
  private chunks: Uint8Array[] = [];

  writeByte(value: number) {
    this.chunks.push(new Uint8Array([value]));
  }

  writeShort(value: number) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, value, true);
    this.chunks.push(b);
  }

  writeInt(value: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, value, true);
    this.chunks.push(b);
  }

  writeLong(value: bigint) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigUint64(0, value, true);
    this.chunks.push(b);
  }

  writeDouble(value: number) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, value, true);
    this.chunks.push(b);
  }

  writeString(value: string) {
    if (!value) return this.writeByte(0);
    this.writeByte(0x0b);
    const bytes = new TextEncoder().encode(value);
    let len = bytes.length;
    while (len >= 0x80) {
      this.writeByte((len & 0x7f) | 0x80);
      len >>= 7;
    }
    this.writeByte(len);
    this.chunks.push(bytes);
  }

  writeRaw(value: Uint8Array) {
    this.chunks.push(value);
  }

  toBuffer(): ArrayBuffer {
    const total = this.chunks.reduce((acc, c) => acc + c.length, 0);
    const res = new Uint8Array(total);
    let off = 0;
    for (const c of this.chunks) {
      res.set(c, off);
      off += c.length;
    }
    return res.buffer;
  }
}
