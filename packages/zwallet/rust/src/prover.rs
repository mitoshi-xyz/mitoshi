//! Proving: Orchard/Ironwood only.
//!
//! Mitoshi never spends or creates Sapling notes (addresses are Orchard-only, change goes to
//! Ironwood, the spend policy is Ironwood + Orchard), so the Sapling provers below are stubs. That
//! keeps the ~50 MB Sapling parameters out of the browser bundle.

use rand_core::Rng;
use sapling::{
    Diversifier, MerklePath, PaymentAddress, ProofGenerationKey, Rseed,
    bundle::GrothProofBytes,
    circuit,
    keys::EphemeralSecretKey,
    prover::{OutputProver, SpendProver},
    value::{NoteValue, ValueCommitTrapdoor},
};
use serde_json::{Value, json};

use crate::Error;

/// Builds and caches the post-NU6.3 Orchard proving key (about 12 s single-threaded), so the
/// first payment does not pay for it. Call once after `init`, in the background.
pub fn warm() -> Result<Value, Error> {
    let started = std::time::Instant::now();
    let _ = zcash_primitives::transaction::builder::cached_orchard_proving_key(
        orchard::circuit::OrchardCircuitVersion::PostNu6_3,
    );
    Ok(json!({ "ms": started.elapsed().as_millis() as u64 }))
}

/// Refuses every Sapling proof; never reached because no Sapling input or output is ever built.
pub struct NoSapling;

impl SpendProver for NoSapling {
    type Proof = ();

    fn prepare_circuit(
        _proof_generation_key: ProofGenerationKey,
        _diversifier: Diversifier,
        _rseed: Rseed,
        _value: NoteValue,
        _alpha: jubjub::Fr,
        _rcv: ValueCommitTrapdoor,
        _anchor: bls12_381::Scalar,
        _merkle_path: MerklePath,
    ) -> Option<circuit::Spend> {
        None
    }

    fn create_proof<R: Rng>(&self, _circuit: circuit::Spend, _rng: &mut R) -> Self::Proof {
        unreachable!("Mitoshi never builds Sapling spends")
    }

    fn encode_proof(_proof: Self::Proof) -> GrothProofBytes {
        unreachable!("Mitoshi never builds Sapling spends")
    }
}

impl OutputProver for NoSapling {
    type Proof = ();

    fn prepare_circuit(
        _esk: &EphemeralSecretKey,
        _payment_address: PaymentAddress,
        _rcm: jubjub::Fr,
        _value: NoteValue,
        _rcv: ValueCommitTrapdoor,
    ) -> circuit::Output {
        unreachable!("Mitoshi never builds Sapling outputs")
    }

    fn create_proof<R: Rng>(&self, _circuit: circuit::Output, _rng: &mut R) -> Self::Proof {
        unreachable!("Mitoshi never builds Sapling outputs")
    }

    fn encode_proof(_proof: Self::Proof) -> GrothProofBytes {
        unreachable!("Mitoshi never builds Sapling outputs")
    }
}

