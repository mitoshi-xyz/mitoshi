import type { PrivateFetch } from "@mitoshi/net";
import type { IRequestTransport } from "@nktkas/hyperliquid";
import { HL_API } from "./constants.ts";

const ERROR_SNIPPET_CHARS = 300;

/**
 * The SDK's request transport, sent over OHTTP: Hyperliquid sees only Mitoshi's gateway, and the
 * relay in between sees only ciphertext. One instance per private wallet keeps nothing shared.
 */
export class OhttpTransport implements IRequestTransport<"info" | "exchange"> {
  readonly isTestnet = false;
  private readonly send: PrivateFetch;

  constructor(send: PrivateFetch) {
    this.send = send;
  }

  async request<T>(endpoint: "info" | "exchange", payload: unknown, signal?: AbortSignal): Promise<T> {
    const init: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    };
    if (signal) init.signal = signal;
    const res = await this.send(`${HL_API}/${endpoint}`, init);
    const text = await res.text();
    if (!res.ok) throw new Error(`Hyperliquid ${endpoint}: HTTP ${res.status} ${text.slice(0, ERROR_SNIPPET_CHARS)}`);
    return JSON.parse(text) as T;
  }
}
