import { H2, List, Note, P, Steps, Title } from "@/features/docs/prose";

export default function RecoveryDocs() {
  return (
    <>
      <Title kicker="Backup and recovery">Your words bring everything back</Title>
      <P>
        Mitoshi keeps nothing for you on a server, so recovery is yours. There are three ways back, from strongest to
        most convenient.
      </P>
      <H2>The 24 words</H2>
      <P>
        The recovery phrase restores the shielded balance (a private scan of the chain from the Ironwood upgrade) and
        every private wallet, because each wallet's key comes from it. After a restore from words alone, Mitoshi finds
        the wallets they made by asking each venue about one derived address at a time, a few seconds apart, until it
        meets a run of unused ones.
      </P>
      <H2>The backup file</H2>
      <P>
        Settings makes an encrypted file holding your words and your private-wallet list (with each wallet's funding
        record), locked with a passphrase you choose (PBKDF2-SHA-256 with 600,000 iterations, then AES-GCM). Restoring
        from it brings the wallets back at once, with no scan.
      </P>
      <H2>The passphrase lock</H2>
      <P>
        Optionally, Mitoshi can ask for a passphrase whenever it opens in this browser. The vault key is then stored
        only wrapped under your passphrase, and every record is re-encrypted under a fresh key in one transaction when
        the lock changes. A locked vault opens nothing, not even the wallet engine, until it is unlocked.
      </P>
      <H2>Starting over</H2>
      <Steps
        items={[
          {
            title: "Forget this browser",
            body: "Settings → Forget, behind a typed confirmation. It erases the vault here; your money stays on the chains.",
          },
          { title: "Restore", body: "From the 24 words or the backup file, on any browser." },
        ]}
      />
      <Note tone="warn">
        Anyone with your 24 words can move your money. Keep them offline, and never type them into a website. Mitoshi
        will never ask for them.
      </Note>
      <H2>If something stops halfway</H2>
      <List
        items={[
          "A funding that failed before anything was sent says so, and Try again waits for a new random start.",
          "A funding whose ZEC was sent goes back to following the swap; NEAR refunds to a fresh shielded address if it can't complete.",
          "A trip home that NEAR refunded leaves the money in the venue wallet, ready to send home again.",
          "If the tab closes while a wallet is being created, it finishes on the next open.",
        ]}
      />
    </>
  );
}
