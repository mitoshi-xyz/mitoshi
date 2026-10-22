import { Code, H2, List, P, Table, Title } from "@/features/docs/prose";

export default function ArchitectureDocs() {
  return (
    <>
      <Title kicker="Architecture">How the pieces fit</Title>
      <P>
        Mitoshi is a static web app. There is no Mitoshi server that holds keys, balances or the map of your wallets:
        only a relay and a gateway that pass sealed requests, and neither can see both ends.
      </P>
      <H2>In the browser</H2>
      <Table
        head={["Piece", "What it does"]}
        rows={[
          [
            "Wallet engine",
            <>
              Zcash's <Code>zcash_client_sqlite</Code> 0.23 compiled to <Code>wasm32-wasip1</Code>, in a Web Worker:
              sync, notes, proofs, sends
            </>,
          ],
          [
            "Vault",
            "IndexedDB, every record AES-GCM encrypted under a non-extractable key (optionally wrapped by a passphrase)",
          ],
          [
            "Engine",
            "Standard sizes, rest rules, random scheduling, the leak meter, key derivation (BIP 32 and SLIP-10)",
          ],
          ["Rails", "NEAR 1Click quotes, deposits and status, with every quote's signature checked"],
          [
            "Venues",
            "Polymarket (official SDK in its own worker), Hyperliquid (official SDK), Solana (Jupiter Ultra, hand-signed transactions)",
          ],
          ["Chart", "A canvas engine for live lines and candles"],
        ]}
      />
      <H2>On the network</H2>
      <List
        items={[
          "Relay: a Cloudflare Worker placed in eu-west-1. It forwards sealed Oblivious HTTP messages, proxies images, and holds one shared stream of public market data per venue.",
          "Gateway: a Vercel Function in Dublin (dub1). It decrypts each message, calls only allowlisted hosts and paths with a fixed header set, and returns the answer sealed. Requests carrying credentials are never cached; it keeps no logs.",
          "The gateway sits off Cloudflare on purpose: a Cloudflare Worker passes the visitor's own country on to every Cloudflare-hosted site it calls, and most venues sit behind Cloudflare.",
          "The gateway also holds Polymarket's Builder credentials for gasless Deposit Wallets, and signs only Deposit Wallet relayer requests.",
        ]}
      />
      <H2>Source</H2>
      <P>
        The code is open: <Code>github.com/mitoshi-xyz/mitoshi</Code>. Packages: <Code>zwallet</Code> (the wallet
        engine), <Code>engine</Code>, <Code>rails</Code>, <Code>venues</Code>, <Code>net</Code> (Oblivious HTTP),{" "}
        <Code>chart</Code>; services: <Code>web</Code> (the relay) and <Code>gateway</Code>.
      </P>
    </>
  );
}
