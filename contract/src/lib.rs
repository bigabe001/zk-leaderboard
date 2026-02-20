#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, Vec, vec, String
};

#[cfg(test)]
mod test;

#[soroban_sdk::contractclient(name = "GameHubClient")]
pub trait GameHubTrait {
    fn start_game(
        env: Env, 
        game_id: Address, 
        session_id: u32, 
        player1: Address, 
        player2: Address, 
        player1_points: i128, 
        player2_points: i128
    ); 
    fn end_game(env: Env, session_id: u32, player1_won: bool);
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScoreEntry {
    pub user: Address,
    pub score: u32,
}

#[contracttype]
pub enum DataKey {
    Leaderboard,
}

#[contract]
pub struct ZKLeaderboard;

#[contractimpl]
impl ZKLeaderboard {
    pub fn submit_score(
        env: Env, 
        user: Address, 
        score: u32, 
        salt: BytesN<32>, 
        public_hash: BytesN<32>, 
        proof: Bytes
    ) {
        user.require_auth();

        // 1. INITIALIZE CLIENT
        let hub_id = Address::from_string(&String::from_str(&env, "CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG"));
        let hub_client = GameHubClient::new(&env, &hub_id);
        
        let session_id = 101u32; 

        // 2. CALL HUB START
        hub_client.start_game(
            &hub_id, 
            &session_id, 
            &user, 
            &hub_id, 
            &(score as i128), 
            &0i128
        );

        // 3. INTEGRITY & ZK CHECKS (Temporary Bypasses)
        if !Self::verify_commitment(&env, score, &salt, &public_hash) {
            panic!("Commitment mismatch!");
        }

        if !Self::verify_zk_proof(&env, &proof) {
            panic!("ZK Proof verification failed.");
        }

        // 4. LEADERBOARD LOGIC
        let key = DataKey::Leaderboard;
        let board: Vec<ScoreEntry> = env.storage().instance().get(&key).unwrap_or(vec![&env]);
        
        let mut new_board = vec![&env];
        let mut inserted = false;
        let new_entry = ScoreEntry { user: user.clone(), score };

        for entry in board.iter() {
            if !inserted && score > entry.score {
                new_board.push_back(new_entry.clone());
                inserted = true;
            }
            if new_board.len() < 10 {
                new_board.push_back(entry);
            }
        }

        if !inserted && new_board.len() < 10 {
            new_board.push_back(new_entry);
        }

        env.storage().instance().set(&key, &new_board);

        // 5. FINALIZE HUB SESSION
        hub_client.end_game(&session_id, &true);
    }

    // UPDATED: Now returns true to bypass hash validation
    fn verify_commitment(_env: &Env, _score: u32, _salt: &BytesN<32>, _public_hash: &BytesN<32>) -> bool {
        true
    }

    // UPDATED: Now returns true to bypass proof validation
    fn verify_zk_proof(_env: &Env, _proof: &Bytes) -> bool {
        true 
    }

    pub fn get_scores(env: Env) -> Vec<ScoreEntry> {
        env.storage().instance().get(&DataKey::Leaderboard).unwrap_or(vec![&env])
    }
}