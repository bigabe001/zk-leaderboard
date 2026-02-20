const { execSync } = require('child_process');
const crypto = require('crypto');

// --- CONFIGURATION ---
const CONTRACT_ID = 'CBXZTIM73OQXMUYHVOYA4M6WA72Z7KZWGTNAA54CRB3MYN6U4N7O6PLR';
const PUBLIC_KEY = 'GD6FH5RZT6UQH6U7TVBCTVXDHO7MAIMY757WDTQYRADN24G335NJI2K2';
const SCORE = 1337;

// 1. Prepare Bytes for hashing (Matching Rust's byte order)
const scoreBuffer = Buffer.alloc(4);
scoreBuffer.writeUInt32BE(SCORE); // score.to_be_bytes()

const saltBytes = crypto.randomBytes(32); // salt: BytesN<32>
const saltHex = saltBytes.toString('hex');

// 2. Generate the Public Hash: sha256(score_bytes + salt_bytes)
const hash = crypto.createHash('sha256')
  .update(scoreBuffer)
  .update(saltBytes)
  .digest('hex');

// 3. Create a Dummy Proof (Must be exactly 256 bytes for your verify_zk_proof)
const proofHex = Buffer.alloc(256, 0).toString('hex');

console.log(`🚀 Submitting Score: ${SCORE}`);
console.log(`🛡️  Salt: ${saltHex}`);
console.log(`🛡️  Public Hash: ${hash}`);

// 4. Build the CLI Command
const command = `stellar contract invoke \
  --id ${CONTRACT_ID} \
  --source admin \
  --network testnet \
  -- submit_score \
  --user ${PUBLIC_KEY} \
  --score ${SCORE} \
  --salt ${saltHex} \
  --public_hash ${hash} \
  --proof ${proofHex}`;

try {
  console.log("🔗 Submitting to Stellar Testnet...");
  const result = execSync(command).toString();
  console.log('✅ Success! Score recorded on the leaderboard.');
  console.log(result);
} catch (error) {
  console.error('❌ Submission Failed:');
  console.error(error.stderr?.toString() || error.message);
}