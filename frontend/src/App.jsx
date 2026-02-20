import { useState, useEffect } from 'react';
import { Contract, rpc, scValToNative, nativeToScVal, TransactionBuilder, Networks, BASE_FEE, Account } from '@stellar/stellar-sdk';
import albedo from '@albedo-link/intent';

const CONTRACT_ID = 'CCZUIMRN3ZYXLRCGBTIROBEKZZXTBXUVOJGQCLBOA2FCBZXSXUAFKHIN';
const RPC_URL = 'https://soroban-testnet.stellar.org';

function App() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userAddress, setUserAddress] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // --- ZK & TIME STATES ---
  const [gameState, setGameState] = useState('IDLE'); 
  const [startTime, setStartTime] = useState(null);
  const [sessionScore, setSessionScore] = useState(0);

  const formatAddress = (addr) => {
    if (!addr) return '...';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // Helper to generate the SHA-256 commitment the contract expects
  const generateCommitment = async (score, salt) => {
    const encoder = new TextEncoder();
    // Convert score to bytes and combine with salt
    const scoreBytes = encoder.encode(score.toString());
    const combined = new Uint8Array(scoreBytes.length + salt.length);
    combined.set(scoreBytes);
    combined.set(salt, scoreBytes.length);
    
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', combined);
    return new Uint8Array(hashBuffer);
  };

  const handleAction = () => {
    if (!userAddress) return connectWallet();
    
    if (gameState === 'IDLE') {
      setGameState('PLAYING');
      setStartTime(Date.now());
    } else if (gameState === 'PLAYING') {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const calculatedScore = Math.max(10, 1000 - timeTaken);
      setSessionScore(calculatedScore);
      setGameState('FINISHED');
    } else {
      submitMyScore();
    }
  };

  const connectWallet = async () => {
    try {
      const res = await albedo.publicKey({ token: 'ZK-Leaderboard-Login' });
      if (res.pubkey) {
        setUserAddress(res.pubkey);
        console.log("Connected via Albedo:", res.pubkey);
      }
    } catch (e) {
      console.error("Albedo Connection Error:", e);
      alert("Connection failed or cancelled.");
    }
  };

  const fetchScores = async () => {
    try {
      setLoading(true);
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const dummyAccount = new Account('GD6FH5RZT6UQH6U7TVBCTVXDHO7MAIMY757WDTQYRADN24G335NJI2K2', "0");

      const tx = new TransactionBuilder(dummyAccount, {
        fee: BASE_FEE.toString(),
        networkPassphrase: Networks.TESTNET,
      })
      .addOperation(contract.call('get_scores'))
      .setTimeout(0)
      .build();

      const response = await server.simulateTransaction(tx);
      if (response && response.result) {
        const rawData = scValToNative(response.result.retval) || [];
        setScores([...rawData].sort((a, b) => Number(b.score) - Number(a.score)));
      }
    } catch (err) {
      console.error('Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitMyScore = async () => {
    try {
      setSubmitting(true);
      const server = new rpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const account = await server.getAccount(userAddress);

      // --- ZK COMMITMENT GENERATION ---
      const saltBytes = window.crypto.getRandomValues(new Uint8Array(32));
      const publicHashBytes = await generateCommitment(sessionScore, saltBytes);
      
      const args = [
        nativeToScVal(userAddress, { type: 'address' }),
        nativeToScVal(Number(sessionScore), { type: 'u32' }), 
        nativeToScVal(saltBytes, { type: 'bytes' }),
        nativeToScVal(publicHashBytes, { type: 'bytes' }),
        nativeToScVal(new Uint8Array(64), { type: 'bytes' }) // Empty proof for now
      ];

      let tx = new TransactionBuilder(account, {
        fee: "100000", 
        networkPassphrase: Networks.TESTNET,
      })
      .addOperation(contract.call("submit_score", ...args))
      .setTimeout(30)
      .build();

      console.log("Preparing transaction...");
      tx = await server.prepareTransaction(tx);

      console.log("Awaiting Albedo signature...");
      const albedoRes = await albedo.tx({
        xdr: tx.toXDR(),
        network: 'testnet'
      });

      console.log("Submitting via Raw RPC...");
      const rpcResponse = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendTransaction",
          params: {
            transaction: albedoRes.signed_envelope_xdr 
          }
        })
      });

      const rawResult = await rpcResponse.json();
      
      if (rawResult.error) {
        throw new Error(`RPC Error: ${rawResult.error.message}`);
      }

      const txHash = rawResult.result.hash;
      console.log("Success! TX Hash:", txHash);

      // Polling for confirmation
      let status = "PENDING";
      while (status === "PENDING" || status === "NOT_FOUND") {
        const poll = await server.getTransaction(txHash);
        status = poll.status;
        if (status === "SUCCESS") {
          alert(`🏆 Score recorded!`);
          setGameState('IDLE');
          fetchScores();
          break;
        } else if (status === "FAILED") {
          throw new Error("Transaction failed on-chain.");
        }
        await new Promise(r => setTimeout(r, 2000));
      }

    } catch (err) {
      console.error("Frontend Error:", err);
      alert("Submission Error: " + (err.message || "Check console"));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => { fetchScores(); }, []);

  return (
    <div className="dashboard-wrapper">
      <div className="glass-card">
        <header className="hero-section">
          <div className="status-pill">LIVE ON TESTNET</div>
          <h1 className="title">ZK LEADERBOARD</h1>
          <p className="contract-id">CONTRACT: <span>{CONTRACT_ID}</span></p>
          
          <div style={{ marginTop: '20px' }}>
            {userAddress ? (
              <span className="user-pill">{formatAddress(userAddress)}</span>
            ) : (
              <button onClick={connectWallet} className="connect-btn">CONNECT WALLET</button>
            )}
          </div>
        </header>

        <section className="board-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Syncing Ledger...</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <div className="table-header">
                <span className="col-rank">RANK</span>
                <span className="col-player">PLAYER</span>
                <span className="col-score">SCORE</span>
              </div>
              <div className="table-body">
                {scores.length > 0 ? (
                  scores.map((s, i) => (
                    <div key={i} className="table-row">
                      <span className="col-rank">#{i + 1}</span>
                      <span className="col-player">{formatAddress(s.user)}</span>
                      <span className="col-score">{Number(s.score)}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No rankings available yet.</div>
                )}
              </div>
            </div>
          )}
        </section>

        <footer className="action-area">
          <button 
            onClick={handleAction} 
            className="glow-button"
            disabled={submitting}
          >
            {submitting ? 'VALIDATING PROOF...' : 
             !userAddress ? 'CONNECT TO PLAY' :
             gameState === 'IDLE' ? 'START NEW GAME' :
             gameState === 'PLAYING' ? 'FINISH GAME' : `SUBMIT SCORE (${sessionScore})`}
          </button>
          
          <button onClick={fetchScores} style={{ background: 'none', border: 'none', color: 'white', opacity: 0.4, marginTop: '15px', cursor: 'pointer', width: '100%', textDecoration: 'underline' }}>
              Refresh Data
          </button>
        </footer>
      </div>

      <style>{`
        :root { --neon: #00ff88; --bg: #050505; --glass: rgba(255, 255, 255, 0.03); --border: rgba(255, 255, 255, 0.12); }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; width: 100%; background: var(--bg); color: white; overflow-x: hidden; }
        .dashboard-wrapper { min-height: 100vh; width: 100vw; display: flex; justify-content: center; align-items: center; padding: 20px; background: radial-gradient(circle at 50% 0%, #1a1a2e 0%, #050505 100%); font-family: 'Inter', sans-serif; }
        .glass-card { width: 100%; max-width: 800px; background: var(--glass); backdrop-filter: blur(25px); border: 1px solid var(--border); border-radius: 24px; padding: clamp(20px, 5vw, 40px); box-shadow: 0 40px 100px rgba(0,0,0,0.8); }
        .hero-section { text-align: center; margin-bottom: 32px; }
        .status-pill { display: inline-block; font-size: 11px; background: var(--neon); color: black; padding: 5px 14px; border-radius: 100px; font-weight: 900; letter-spacing: 1.2px; margin-bottom: 12px; box-shadow: 0 0 15px rgba(0, 255, 136, 0.4); }
        .title { font-size: clamp(2rem, 8vw, 3.5rem); font-weight: 900; letter-spacing: -2px; line-height: 1; }
        .contract-id { font-size: clamp(10px, 2vw, 13px); opacity: 0.4; font-family: monospace; margin-top: 12px; word-break: break-all; }
        .contract-id span { color: var(--neon); }
        .user-pill { background: rgba(0, 255, 136, 0.1); border: 1px solid var(--neon); color: var(--neon); padding: 6px 12px; border-radius: 8px; font-family: monospace; font-size: 14px; }
        .connect-btn { background: transparent; border: 1px solid var(--neon); color: var(--neon); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }
        .connect-btn:hover { background: var(--neon); color: black; }
        .table-wrapper { width: 100%; background: rgba(0,0,0,0.3); border-radius: 16px; border: 1px solid var(--border); overflow: hidden; }
        .table-header, .table-row { display: grid; grid-template-columns: 80px 1fr 100px; padding: 18px 24px; align-items: center; }
        .table-header { background: rgba(255,255,255,0.04); font-size: 11px; font-weight: 800; color: #888; border-bottom: 1px solid var(--border); }
        .table-row { border-bottom: 1px solid rgba(255,255,255,0.03); }
        .col-rank { font-weight: 700; color: #555; font-size: 14px; }
        .col-player { font-family: 'JetBrains Mono', monospace; font-size: 15px; opacity: 0.9; }
        .col-score { text-align: right; color: var(--neon); font-weight: 900; font-size: 22px; }
        .empty-state { text-align: center; padding: 60px; opacity: 0.4; }
        .glow-button { width: 100%; margin-top: 32px; padding: 20px; border-radius: 16px; border: none; background: white; color: black; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.3s; }
        .glow-button:hover { background: var(--neon); transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0, 255, 136, 0.3); }
        .glow-button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid var(--neon); border-radius: 50%; margin: 0 auto 20px; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 600px) { .table-header, .table-row { grid-template-columns: 50px 1fr 80px; padding: 14px 16px; } .col-player { font-size: 13px; } .col-score { font-size: 18px; } }
      `}</style>
    </div>
  );
}

export default App;