import type { PrivateFetch } from "@mitoshi/net";
import { LWD_SERVICE } from "./constants";

const FRAME_FLAG_BYTES = 1;
const FRAME_LENGTH_BYTES = 4;
const FRAME_HEADER_BYTES = FRAME_FLAG_BYTES + FRAME_LENGTH_BYTES;
const TRAILER_FLAG = 0x80;
const STATUS_OK = /grpc-status:\s*0\b/;

/**
 * One unary or server-streaming lightwalletd call over gRPC-web. Returns every message payload.
 * `send` is Mitoshi's OHTTP fetch, so the light server sees only the gateway and the relay sees
 * only ciphertext.
 */
export async function lwdCall(
  send: PrivateFetch,
  base: string,
  method: string,
  body: Uint8Array,
  signal?: AbortSignal,
): Promise<Uint8Array[]> {
  const frame = new Uint8Array(FRAME_HEADER_BYTES + body.length);
  new DataView(frame.buffer).setUint32(FRAME_FLAG_BYTES, body.length);
  frame.set(body, FRAME_HEADER_BYTES);
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/grpc-web+proto", "x-grpc-web": "1" },
    body: frame,
  };
  if (signal) init.signal = signal;
  const res = await send(`${base}/${LWD_SERVICE}/${method}`, init);
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  // Trailers-only responses carry the status in headers instead of a trailer frame.
  const headerStatus = res.headers.get("grpc-status");
  if (headerStatus !== null && headerStatus !== "0") {
    throw new Error(`${method}: grpc-status ${headerStatus} ${res.headers.get("grpc-message") ?? ""}`.trim());
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const messages: Uint8Array[] = [];
  let i = 0;
  while (i < bytes.length) {
    const flag = bytes[i] ?? 0;
    const len = new DataView(bytes.buffer, bytes.byteOffset + i + FRAME_FLAG_BYTES, FRAME_LENGTH_BYTES).getUint32(0);
    const payload = bytes.subarray(i + FRAME_HEADER_BYTES, i + FRAME_HEADER_BYTES + len);
    if ((flag & TRAILER_FLAG) === 0) {
      messages.push(payload);
    } else {
      const trailers = new TextDecoder().decode(payload);
      if (!STATUS_OK.test(trailers)) throw new Error(`${method}: ${trailers.trim()}`);
    }
    i += FRAME_HEADER_BYTES + len;
  }
  return messages;
}
