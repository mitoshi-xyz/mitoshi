/** The parts of 1Click's API Mitoshi uses (docs.near-intents.org, openapi v0). */

export type SwapType = "EXACT_INPUT" | "EXACT_OUTPUT" | "FLEX_INPUT";
export type Confidentiality = "public" | "basic" | "advanced";

export interface QuoteRequest {
  dry: boolean;
  swapType: SwapType;
  slippageTolerance: number;
  originAsset: string;
  depositType: "ORIGIN_CHAIN";
  destinationAsset: string;
  amount: string;
  refundTo: string;
  refundType: "ORIGIN_CHAIN";
  recipient: string;
  recipientType: "DESTINATION_CHAIN";
  deadline: string;
  confidentiality?: Confidentiality;
  appFees?: { recipient: string; fee: number }[];
  quoteWaitingTimeMs?: number;
  referral?: string;
  virtualChainRecipient?: string;
  virtualChainRefundRecipient?: string;
  customRecipientMsg?: string;
}

export interface Quote {
  depositAddress?: string;
  depositMemo?: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  minAmountIn: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  minAmountOut: string;
  deadline?: string;
  timeWhenInactive?: string;
  timeEstimate: number;
  refundFee?: string;
  withdrawFee?: string;
}

export interface QuoteResponse {
  correlationId: string;
  timestamp: string;
  signature: string;
  quoteRequest: QuoteRequest;
  quote: Quote;
}

export type ExecutionStatus =
  | "KNOWN_DEPOSIT_TX"
  | "PENDING_DEPOSIT"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export interface TxDetails {
  hash: string;
  explorerUrl: string;
}

export interface StatusResponse {
  correlationId: string;
  status: ExecutionStatus;
  updatedAt: string;
  quoteResponse: QuoteResponse;
  swapDetails: {
    intentHashes: string[];
    nearTxHashes: string[];
    amountOut?: string;
    amountOutFormatted?: string;
    originChainTxHashes: TxDetails[];
    destinationChainTxHashes: TxDetails[];
    refundedAmount?: string;
    refundedAmountFormatted?: string;
    refundReason?: string;
    depositedAmount?: string;
  };
}
