# Decentralized ZK-Leaderboard

A high-performance, verifiable gaming leaderboard built on **Stellar Soroban**. This project solves the "trust gap" in global gaming by using Zero-Knowledge (ZK) primitives to ensure score integrity, paired with a mandatory integration with the **Stellar Game Hub**.

## Live on Testnet
The contract is fully deployed, optimized, and verified. You can inspect the live methods, events, and state history on the Stellar explorer.

* **Contract ID**: `CCZUIMRN3ZYXLRCGBTIROBEKZZXTBXUVOJGQCLBOA2FCBZXSXUAFKHIN`
* **Explorer**: [View Live on Stellar Lab Explorer](https://lab.stellar.org/smart-contracts/contract-explorer?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015;&smartContracts$explorer$contractId=CCZUIMRN3ZYXLRCGBTIROBEKZZXTBXUVOJGQCLBOA2FCBZXSXUAFKHIN;;)

---

## The ZK Mechanic: Provable Outcomes
This project implements a **Commitment-Hash Scheme**, shifting the burden of trust from the server to the protocol.



1.  **Hiding & Binding**: During gameplay, the client generates a secret `salt` and hashes it with the `score`. This "commits" the player to a result without revealing it until the game ends.
2.  **On-chain Validation**: The contract only accepts the submission if the player provides the `salt` and `score` that reproduce the previously submitted `public_hash`. This prevents "score-padding" or post-game manipulation.
3.  **High-Efficiency Optimization**:
    * **Original WASM**: 19,035 bytes
    * **Optimized WASM**: 6,150 bytes (**68% footprint reduction**)
    * **Benefit**: Significant reduction in ledger storage fees and CPU instructions, maximizing performance for real-time leaderboards.

### Protocol 25 (X-Ray) Readiness
We have architected this contract with the **X-Ray upgrade** in mind to leverage native cryptographic host functions:

* **Poseidon Integration**: Our current `SHA-256` commitment logic is "Plug-and-Play." We are prepared to migrate to the native `poseidon` host function, which is mathematically optimized for ZK circuits, reducing proof-generation time and on-chain verification costs.
* **BN254 Support**: The `verify_zk_proof` interface is a dedicated logic gate ready to receive **Noir** or **RISC Zero** proofs. By utilizing the new BN254 elliptic curve operations, we can verify full SNARKs natively on-chain.

---

## Hackathon Requirement: Game Hub Handshake
We have strictly followed the requirement to integrate with the **Stellar Game Hub** (`CB4VZ...`). 



### Verified Gameplay Lifecycle:
Every score submission triggers a secure cross-contract handshake:
1.  **`start_game()`**: Called on the Hub to initialize the session.
2.  **`end_game()`**: Finalizes the outcome and reports the winner.

> **Live Proof of Integration**:  
> **Transaction Hash**: `c53e8f38...`  
> **Captured Event**: `session_id: 101`, `player1_won: true`.  
> *This confirms our contract successfully communicated with the Global Hub during the submission process.*

---

## Build & Verification (Makefile)
To reproduce our results or interact with the contract, use the provided `Makefile` tasks:

```bash
make build       # Compile and Optimize the contract
make deploy      # Deploy to Testnet using the 'admin' identity
make get-scores  # Manually verify the leaderboard state via CLI