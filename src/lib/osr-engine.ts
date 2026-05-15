import { compress, decompress } from 'lzma1';
import { MOD_TARGET_PRACTICE, LZMA_COMPRESSION_LEVEL, REPLAY_MAX_COORDINATE_VALUE } from '../config/replay';
import { ReplayData, ReplayFrame } from '../types/replay';
import { BinaryStream, BinaryWriter } from './binary-adapter';

function parseFrames(framesStr: string): ReplayFrame[] {
  const out: ReplayFrame[] = [];
  let carryMs = 0;
  const segments = framesStr.split(',');
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    const parts = segment.split('|');
    if (parts.length < 4) continue;
    const [t, x, y, k] = parts;
    const timeDelta = Number(t);
    const px = Number(x);
    const py = Number(y);
    const keys = Number(k);
    if (!Number.isFinite(timeDelta) || !Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(keys)) continue;
    if (Math.abs(px) > REPLAY_MAX_COORDINATE_VALUE || Math.abs(py) > REPLAY_MAX_COORDINATE_VALUE) continue;
    if (timeDelta === -12345) continue;

    carryMs += timeDelta;

    if (i < 2 && px === 256 && py === -500) continue;

    if (timeDelta < 0) continue;

    if (timeDelta === 0 && out.length > 0) {
      const last = out[out.length - 1];
      last.keys |= keys;
      last.x = px;
      last.y = py;
      continue;
    }

    out.push({
      timeDelta: carryMs,
      x: px,
      y: py,
      keys,
    });
    carryMs = 0;
  }
  return out;
}

function serializeFrames(frames: ReplayFrame[]): string {
  return frames.map((f) => `${f.timeDelta}|${f.x}|${f.y}|${f.keys}`).join(',') + ',';
}

function lzmaDecompress(compressed: Uint8Array): string {
  const raw = decompress(compressed);
  return new TextDecoder().decode(raw);
}

function lzmaCompress(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  return compress(bytes, LZMA_COMPRESSION_LEVEL);
}

export const OSREngine = {
  decode(buffer: ArrayBuffer): ReplayData {
    const s = new BinaryStream(buffer);
    const data: ReplayData = {
      mode: s.readByte(),
      version: s.readInt(),
      beatmapHash: s.readString(),
      playerName: s.readString(),
      replayHash: s.readString(),
      count300: s.readShort(),
      count100: s.readShort(),
      count50: s.readShort(),
      countGeki: s.readShort(),
      countKatu: s.readShort(),
      countMiss: s.readShort(),
      score: s.readInt(),
      maxCombo: s.readShort(),
      perfect: s.readByte(),
      mods: s.readInt(),
      lifeBar: s.readString(),
      timestamp: s.readLong(),
      scoreId: 0n,
      targetPracticeAccuracy: null,
      frames: [],
    };

    const compressedLength = s.readInt();
    const compressed = s.readBytes(compressedLength);
    const framesStr = lzmaDecompress(compressed);
    data.frames = parseFrames(framesStr);

    if (s.getRemaining().byteLength >= 8) {
      data.scoreId = s.readLong();
    }
    if ((data.mods & MOD_TARGET_PRACTICE) !== 0 && s.getRemaining().byteLength >= 8) {
      data.targetPracticeAccuracy = s.readDouble();
    }

    return data;
  },

  encode(data: ReplayData): ArrayBuffer {
    const w = new BinaryWriter();
    w.writeByte(data.mode);
    w.writeInt(data.version);
    w.writeString(data.beatmapHash);
    w.writeString(data.playerName);
    w.writeString(data.replayHash);
    w.writeShort(data.count300);
    w.writeShort(data.count100);
    w.writeShort(data.count50);
    w.writeShort(data.countGeki);
    w.writeShort(data.countKatu);
    w.writeShort(data.countMiss);
    w.writeInt(data.score);
    w.writeShort(data.maxCombo);
    w.writeByte(data.perfect);
    w.writeInt(data.mods);
    w.writeString(data.lifeBar);
    w.writeLong(data.timestamp);

    const framesPayload = serializeFrames(data.frames);
    const compressed = lzmaCompress(framesPayload);
    w.writeInt(compressed.byteLength);
    w.writeRaw(compressed);
    w.writeLong(data.scoreId ?? 0n);
    if ((data.mods & MOD_TARGET_PRACTICE) !== 0) {
      w.writeDouble(data.targetPracticeAccuracy ?? 0);
    }

    return w.toBuffer();
  },
};
