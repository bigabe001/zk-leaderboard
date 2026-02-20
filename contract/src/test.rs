#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Bytes, BytesN, testutils::Address as _};

#[test]
fn test_secure_submission() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ZKLeaderboard);
    let client = ZKLeaderboardClient::new(&env, &contract_id);

    let alice = Address::generate(&env);
    let score: u32 = 100;
    let salt = BytesN::from_array(&env, &[0; 32]);
    
    // Create the expected hash: sha256(score + salt)
    let mut data = Bytes::new(&env);
    data.append(&Bytes::from_array(&env, &score.to_be_bytes()));
    data.append(&salt.clone().into());
    let public_hash = env.crypto().sha256(&data);

    let mock_proof = Bytes::from_slice(&env, &[0; 256]);

    client.submit_score(&alice, &score, &salt, &public_hash, &mock_proof);

    let scores = client.get_scores();
    assert_eq!(scores.get(0).unwrap().score, 100);
}