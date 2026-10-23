import { AEAD_AES_128_GCM, CipherSuite, KDF_HKDF_SHA256, KEM_DHKEM_X25519_HKDF_SHA256 } from "hpke";
import { KeyConfig, MediaType, OHTTPServer } from "ohttp-ts";
import { type BuilderCredentials, builderSign } from "./builder";
import { BUILDER_SIGN_HOST, IMAGE_HOST, OHTTP_KEY_ID, OHTTP_MAX_MESSAGE_BYTES, OHTTP_SEED_BYTES } from "./constants";
import { img } from "./img";
import { forward, type Secrets } from "./upstream";

/**
 * The OHTTP gateway (RFC 9458). The relay in front of it sees the user's IP but only ciphertext;
 * this side sees the request but only the relay's address. The key pair is derived from a secret
 * seed so every instance publishes the same key configuration.
 */

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
/** The largest inner answer sealed whole: under Vercel's 4.5 MB response limit once padded and encrypted. */
const MAX_ANSWER_BYTES = 4_194_304;
const HTTP_UNAVAILABLE = 503;
const HEX_RADIX = 16;
const HEX_CHARS_PER_BYTE = 2;

export const SUITE = new CipherSuite(KEM_DHKEM_X25519_HKDF_SHA256, KDF_HKDF_SHA256, AEAD_AES_128_GCM);

interface Keys {
  server: OHTTPServer;
  published: Uint8Array;
}

let keys: Promise<Keys> | null = null;

function seedBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (!/^[0-9a-f]+$/i.test(clean) || clean.length !== OHTTP_SEED_BYTES * HEX_CHARS_PER_BYTE) {
    throw new Error("OHTTP_SEED must be 32 bytes of hex");
  }
  return Uint8Array.from({ length: OHTTP_SEED_BYTES }, (_, i) =>
    Number.parseInt(clean.slice(i * HEX_CHARS_PER_BYTE, (i + 1) * HEX_CHARS_PER_BYTE), HEX_RADIX),
  );
}

function loadKeys(seedHex: string | undefined): Promise<Keys> {
  if (!seedHex) return Promise.reject(new Error("OHTTP_SEED is not set"));
  keys ??= (async () => {
    const config = await KeyConfig.derive(SUITE, seedBytes(seedHex), OHTTP_KEY_ID);
    return {
      server: new OHTTPServer([config], { maxMessageSize: OHTTP_MAX_MESSAGE_BYTES }),
      published: KeyConfig.serializeMultiple([config]),
    };
  })();
  return keys;
}

/** `GET /ohttp-keys`: the public key configuration (application/ohttp-keys). */
export async function ohttpKeys(seedHex: string | undefined): Promise<Response> {
  try {
    const { published } = await loadKeys(seedHex);
    return new Response(new Uint8Array(published), {
      headers: { "content-type": MediaType.KEYS, "cache-control": "public, max-age=3600" },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "keys unavailable" }, { status: HTTP_UNAVAILABLE });
  }
}

/** `POST /ohttp`: decrypts one request, calls the upstream it names, encrypts the answer. */
export async function ohttp(
  request: Request,
  seedHex: string | undefined,
  secrets: Secrets = {},
  builder: BuilderCredentials | null = null,
): Promise<Response> {
  if (request.method !== "POST" || request.headers.get("content-type") !== MediaType.REQUEST) {
    return new Response("expected message/ohttp-req", { status: HTTP_BAD_REQUEST });
  }
  let server: OHTTPServer;
  try {
    server = (await loadKeys(seedHex)).server;
  } catch {
    return new Response("gateway keys unavailable", { status: HTTP_UNAVAILABLE });
  }
  let decapsulated: Awaited<ReturnType<OHTTPServer["decapsulateRequest"]>>;
  try {
    decapsulated = await server.decapsulateRequest(request);
  } catch {
    // Opaque on purpose (RFC 9458 §5.2): a bad key id or a tampered message look the same.
    return new Response("could not decrypt", { status: HTTP_BAD_REQUEST });
  }
  const target = new URL(decapsulated.request.url);
  const inner =
    target.hostname === BUILDER_SIGN_HOST
      ? await builderSign(decapsulated.request, builder)
      : target.hostname === IMAGE_HOST
        ? await img(decapsulated.request)
        : await forward(decapsulated.request, secrets);
  // An answer too big for one message (or for the host's response limit) would fail the whole function with a bare
  // 500: say so inside the sealed answer instead, so the app can show what happened.
  const body = await inner.arrayBuffer();
  const sealed =
    body.byteLength <= MAX_ANSWER_BYTES
      ? new Response(body, { status: inner.status, headers: inner.headers })
      : new Response("answer too large for one message", { status: HTTP_BAD_GATEWAY });
  return decapsulated.context.encapsulateResponse(sealed);
}
