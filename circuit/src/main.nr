use dep::std;

fn main(
    secret_score: Field, 
    public_hash: pub Field,
    threshold: pub Field
) {
    let computed_hash = std::hash::pedersen_hash([secret_score]);
    
    // Add this line to see the real hash in your terminal
    std::println(computed_hash); 

    assert(computed_hash == public_hash);
    assert(secret_score as u32 > threshold as u32);
}

#[test]
fn test_valid_score() {
    let secret = 5000;
    let threshold = 1000;
    let p_hash = std::hash::pedersen_hash([secret]);
    main(secret, p_hash, threshold);
}