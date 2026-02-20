# Decentralized ZK-Leaderboard

A high-performance, verifiable gaming leaderboard built on **Stellar Soroban**. This project solves the "trust gap" in global gaming by using Zero-Knowledge (ZK) primitives to ensure score integrity, paired with a mandatory integration with the **Stellar Game Hub**.

** [Launch Live App](https://zk-leaderboard.vercel.app/)**

---

## Live on Testnet
The contract is fully deployed, optimized, and verified. You can inspect the live methods, events, and state history on the Stellar explorer.

* **Contract ID:** `CCZUIMRN3ZYXLRCGBTIROBEKZZXTBXUVOJGQCLBOA2FCBZXSXUAFKHIN`
* **Explorer:** [View Live on Stellar Lab Explorer](https://stellar.expert/explorer/testnet/contract/CCZUIMRN3ZYXLRCGBTIROBEKZZXTBXUVOJGQCLBOA2FCBZXSXUAFKHIN)
* **Network:** Testnet (Protocol 22+)

---

## The ZK Mechanic: Provable Outcomes
This project implements a **Commitment-Hash Scheme**, shifting the burden of trust from the server to the protocol.



* **Hiding & Binding:** During gameplay, the client uses the browser's `SubtleCrypto` API to generate a cryptographically secure 32-byte **salt** and hashes it with the **score**. This "commits" the player to a result without revealing it until the game ends.
* **On-chain Validation:** The contract only accepts the submission if the player provides the salt and score that reproduce the previously submitted `public_hash`. This prevents "score-padding" or post-game manipulation.
* **Client-Side Hashing:** We utilize `window.crypto.subtle.digest('SHA-256', ...)` to ensure the commitment is generated in a secure environment before it ever touches the network.

---

## Technical Implementation Details (New Updates)

### 1. SDK-Agnostic RPC Submission
To overcome limitations in `stellar-sdk v14.5.0` regarding XDR parsing with Albedo, we implemented a **Raw JSON-RPC Submission Layer**. This bypasses SDK internal errors by communicating directly with the Soroban RPC via Fetch.

### 2. Protocol-Compliant Named Parameters
We transitioned from positional arguments to **Named Parameter Objects** (`params: { transaction: XDR }`). This ensures compatibility with the latest Go-based Soroban RPC (Protocol 22/25), resolving "invalid parameter" errors.

### 3. High-Efficiency Optimization
* **Original WASM:** 19,035 bytes
* **Optimized WASM:** 6,150 bytes (**68% footprint reduction**)
* **Benefit:** Significant reduction in ledger storage fees and CPU instructions, maximizing performance for real-time leaderboards.

---

## Protocol 25 (X-Ray) Readiness
We have architected this contract with the **X-Ray upgrade** in mind to leverage native cryptographic host functions:

* **Poseidon Integration:** Our current SHA-256 commitment logic is "Plug-and-Play." We are prepared to migrate to the native `poseidon` host function, which is mathematically optimized for ZK circuits.
* **BN254 Support:** The `verify_zk_proof` interface is a dedicated logic gate ready to receive **Noir** or **RISC Zero** proofs. By utilizing the new BN254 elliptic curve operations, we can verify full SNARKs natively on-chain.

---

## Hackathon Requirement: Game Hub Handshake
We have strictly followed the requirement to integrate with the **Stellar Game Hub** (`CB4VZ...`). Every score submission triggers a secure cross-contract handshake:

1.  **`start_game()`**: Called on the Hub to initialize the session and link it to the player's identity.
2.  **`end_game()`**: Finalizes the outcome and reports the winner to the global registry.

**Live Proof of Integration:**
* **Transaction Hash:** `0d03598aa68738772617f28898982df0da09c87d9ff8e33e0398f65fea0adc66`
* **Captured Event:** `session_id: 101, player1_won: true`.

---

## Build & Verification (Makefile)
To reproduce our results or interact with the contract, use the provided `Makefile` tasks:

```bash
make build       # Compile and Optimize the contract using Soroban CLI
make deploy      # Deploy to Testnet using the 'admin' identity
make get-scores  # Manually verify the leaderboard state via CLI
make install     # Install dependencies (Stellar SDK, Albedo)
