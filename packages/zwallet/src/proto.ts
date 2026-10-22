/**
 * The few protobuf encodings lightwalletd requests need. Responses are decoded by the Rust core
 * (prost), except BlockID heights, which the sync loop reads directly.
 */

const SEVEN_BITS = 0x7fn;
const CONTINUE = 0x80;
const WIRE_VARINT = 0;
const WIRE_LEN = 2;
const FIELD_SHIFT = 3n;
const WIRE_MASK = 7n;
const VARINT_SHIFT = 7n;
const INT32_BITS = 32;
/** Bytes of the little-endian length before each framed message. */
const FRAME_LENGTH_BYTES = 4;

export function varint(value: number | bigint): number[] {
  const out: number[] = [];
  let v = BigInt(value);
  do {
    let byte = Number(v & SEVEN_BITS);
    v >>= VARINT_SHIFT;
    if (v) byte |= CONTINUE;
    out.push(byte);
  } while (v);
  return out;
}

const key = (field: number, wire: number) => varint((BigInt(field) << FIELD_SHIFT) | BigInt(wire));

export const uintField = (field: number, value: number | bigint) => [...key(field, WIRE_VARINT), ...varint(value)];

export const bytesField = (field: number, bytes: ArrayLike<number>) => [
  ...key(field, WIRE_LEN),
  ...varint(bytes.length),
  ...Array.from(bytes),
];

/** `BlockID { height }` */
export const blockId = (height: number) => uintField(1, height);

/** `BlockRange { start, end }` (end inclusive in lightwalletd). */
export const blockRange = (start: number, endInclusive: number) =>
  new Uint8Array([...bytesField(1, blockId(start)), ...bytesField(2, blockId(endInclusive))]);

/** `GetSubtreeRootsArg { startIndex, shieldedProtocol }` */
export const subtreeRootsArg = (startIndex: number, protocol: number) =>
  new Uint8Array([...uintField(1, startIndex), ...uintField(2, protocol)]);

/** `RawTransaction { data }` */
export const rawTransaction = (raw: Uint8Array) => new Uint8Array(bytesField(1, raw));

function readVarint(buf: Uint8Array, start: number): [bigint, number] {
  let value = 0n;
  let shift = 0n;
  let i = start;
  for (;;) {
    const byte = buf[i];
    if (byte === undefined) throw new Error("truncated varint");
    i++;
    value |= BigInt(byte & Number(SEVEN_BITS)) << shift;
    if ((byte & CONTINUE) === 0) return [value, i];
    shift += VARINT_SHIFT;
  }
}

/** Reads `BlockID.height` (field 1). */
export function blockIdHeight(buf: Uint8Array): number {
  let i = 0;
  while (i < buf.length) {
    const [k, afterKey] = readVarint(buf, i);
    const field = Number(k >> FIELD_SHIFT);
    const wire = Number(k & WIRE_MASK);
    if (wire === WIRE_VARINT) {
      const [v, next] = readVarint(buf, afterKey);
      if (field === 1) return Number(v);
      i = next;
    } else if (wire === WIRE_LEN) {
      const [len, next] = readVarint(buf, afterKey);
      i = next + Number(len);
    } else {
      throw new Error(`unexpected wire type ${wire}`);
    }
  }
  throw new Error("BlockID has no height");
}

/** Reads `SendResponse { errorCode = 1, errorMessage = 2 }`. */
export function sendResponse(buf: Uint8Array): { code: number; message: string } {
  let code = 0;
  let message = "";
  let i = 0;
  while (i < buf.length) {
    const [k, afterKey] = readVarint(buf, i);
    const field = Number(k >> FIELD_SHIFT);
    const wire = Number(k & WIRE_MASK);
    if (wire === WIRE_VARINT) {
      const [v, next] = readVarint(buf, afterKey);
      if (field === 1) code = Number(BigInt.asIntN(INT32_BITS, v));
      i = next;
    } else if (wire === WIRE_LEN) {
      const [len, next] = readVarint(buf, afterKey);
      const end = next + Number(len);
      if (field === 2) message = new TextDecoder().decode(buf.subarray(next, end));
      i = end;
    } else {
      throw new Error(`unexpected wire type ${wire}`);
    }
  }
  return { code, message };
}

/** Joins messages as `[u32 little-endian length][message]...` for the Rust core. */
export function framed(messages: Uint8Array[]): Uint8Array {
  const total = messages.reduce((n, m) => n + FRAME_LENGTH_BYTES + m.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let offset = 0;
  for (const m of messages) {
    view.setUint32(offset, m.length, true);
    out.set(m, offset + FRAME_LENGTH_BYTES);
    offset += FRAME_LENGTH_BYTES + m.length;
  }
  return out;
}
