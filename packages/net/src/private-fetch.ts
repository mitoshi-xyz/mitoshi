import { AEAD_AES_128_GCM, CipherSuite, KDF_HKDF_SHA256, KEM_DHKEM_X25519_HKDF_SHA256 } from "hpke";
import { KeyConfig, MediaType, OHTTPClient } from "ohttp-ts";
import { GATEWAY_KEY_CONFIG, OHTTP_MAX_MESSAGE_BYTES, RELAY_PATHS } from "./constants";

/** How much of a relay error body is kept in the thrown message. */
const ERROR_SNIPPET_CHARS = 200;

const SUITE = new CipherSuite(KEM_DHKEM_X25519_HKDF_SHA256, KDF_HKDF_SHA256, AEAD_AES_128_GCM);

export type PrivateFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

function base64Bytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

let client: OHTTPClient | null = null;

function ohttpClient(): OHTTPClient {
  if (!client) {
    const [config] = KeyConfig.parseMultiple(base64Bytes(GATEWAY_KEY_CONFIG));
    if (!config) throw new Error("no OHTTP key configuration");
    client = new OHTTPClient(SUITE, config, { maxMessageSize: OHTTP_MAX_MESSAGE_BYTES });
  }
  return client;
}

/**
 * A `fetch` that sends the request to its real URL through Oblivious HTTP: it is encrypted to the
 * gateway's key, posted to the relay (which sees this browser's IP but not the request), and the
 * gateway (which sees the request but not the IP) calls the upstream. Each call uses a fresh HPKE
 * context, so two calls cannot be linked by their encryption. Padding hides exact sizes.
 */
export function createPrivateFetch(relayBase: string): PrivateFetch {
  const endpoint = `${relayBase}${RELAY_PATHS.ohttp}`;
  return async (url, init) => {
    const inner = new Request(url, { ...init, credentials: "omit", referrerPolicy: "no-referrer" });
    const { init: outer, context } = await ohttpClient().encapsulateRequest(inner);
    const res = await fetch(endpoint, {
      ...outer,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: init?.signal ?? null,
    });
    if (res.headers.get("content-type") !== MediaType.RESPONSE) {
      throw new Error(`relay error ${res.status}: ${(await res.text()).slice(0, ERROR_SNIPPET_CHARS)}`);
    }
    return context.decapsulateResponse(res);
  };
}
