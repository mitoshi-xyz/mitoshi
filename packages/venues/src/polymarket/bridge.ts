import type { PrivateFetch } from "@mitoshi/net";
import { BRIDGE_API, POLYGON_CHAIN_ID, POLYGON_USDC, PUSD } from "./constants.ts";

/**
 * Polymarket's bridge (docs.polymarket.com/trading/bridge): how a Deposit Wallet is funded (USDC
 * sent to its bridge address becomes pUSD in the wallet) and how money leaves (pUSD sent to a
 * withdrawal address arrives as USDC wherever it was configured to go). Every call is OHTTP.
 */

export type BridgeStatus =
  | "DEPOSIT_DETECTED"
  | "PROCESSING"
  | "ORIGIN_TX_CONFIRMED"
  | "SUBMITTED"
  | "COMPLETED"
  | "FAILED";

export interface BridgeTransfer {
  status: BridgeStatus;
  fromAmountBaseUnit: string;
  toTokenAddress: string;
  txHash?: string;
  createdTimeMs?: number;
}

export interface BridgeQuote {
  /** What arrives, in the destination token's base units. */
  out: string;
  feeUsd: number;
  feePercent: number;
  seconds: number;
}

const MS_PER_SECOND = 1000;
const POLYGON_SOURCE: BridgeSource = { chainId: POLYGON_CHAIN_ID, usdc: POLYGON_USDC };

/** A chain USDC can come from into a Deposit Wallet's bridge address. */
export interface BridgeSource {
  chainId: number;
  usdc: string;
}

export class PolymarketBridge {
  private readonly send: PrivateFetch;
  constructor(send: PrivateFetch) {
    this.send = send;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    // No builder code: it is optional, and nothing here needs to name Mitoshi to Polymarket's bridge provider.
    const res = await this.send(`${BRIDGE_API}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as T & { error?: string; message?: string };
    if (!res.ok) throw new Error(`Polymarket bridge: ${json.error ?? json.message ?? `HTTP ${res.status}`}`);
    return json;
  }

  /** The Polygon address that turns USDC into pUSD for this Deposit Wallet (where NEAR delivers a funding). */
  async depositAddress(wallet: string): Promise<string> {
    const r = await this.post<{ address: { evm?: string } }>("/deposit", { address: wallet });
    if (!r.address.evm) throw new Error("Polymarket bridge gave no EVM deposit address");
    return r.address.evm;
  }

  /**
   * A one-use address that turns this wallet's pUSD into native USDC on Polygon, paid to
   * `recipient` (the NEAR deposit address of the trip home). Make it only when sending right away.
   */
  async withdrawalAddress(wallet: string, recipient: string): Promise<string> {
    const r = await this.post<{ address: { evm?: string } }>("/withdraw", {
      address: wallet,
      toChainId: String(POLYGON_CHAIN_ID),
      toTokenAddress: POLYGON_USDC,
      recipientAddr: recipient,
    });
    if (!r.address.evm) throw new Error("Polymarket bridge gave no EVM withdrawal address");
    return r.address.evm;
  }

  /**
   * What a funding (USDC on `source` → pUSD) or a trip home (pUSD → USDC on Polygon) of `amount`
   * base units would come to.
   */
  async quote(
    direction: "in" | "out",
    amount: string,
    recipient: string,
    source = POLYGON_SOURCE,
  ): Promise<BridgeQuote> {
    const r = await this.post<{
      estToTokenBaseUnit: string;
      estCheckoutTimeMs: number;
      estFeeBreakdown?: { totalImpactUsd?: number; totalImpact?: number };
    }>("/quote", {
      fromAmountBaseUnit: amount,
      fromChainId: String(direction === "in" ? source.chainId : POLYGON_CHAIN_ID),
      fromTokenAddress: direction === "in" ? source.usdc : PUSD,
      recipientAddress: recipient,
      toChainId: String(POLYGON_CHAIN_ID),
      toTokenAddress: direction === "in" ? PUSD : POLYGON_USDC,
    });
    return {
      out: r.estToTokenBaseUnit,
      feeUsd: r.estFeeBreakdown?.totalImpactUsd ?? 0,
      feePercent: r.estFeeBreakdown?.totalImpact ?? 0,
      seconds: Math.round(r.estCheckoutTimeMs / MS_PER_SECOND),
    };
  }

  /** The newest transfer through a bridge address (a funding or a withdrawal), or null before one is seen. */
  async latest(bridgeAddress: string): Promise<BridgeTransfer | null> {
    const res = await this.send(`${BRIDGE_API}/status/${bridgeAddress}?limit=1`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Polymarket bridge status: HTTP ${res.status}`);
    const r = (await res.json()) as { transactions?: BridgeTransfer[] };
    return r.transactions?.[0] ?? null;
  }
}
