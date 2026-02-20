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

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  const formatAddress = (addr) => {
    if (!addr) return '...';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`.toUpperCase();
  };

  const generateCommitment = async (score, salt) => {
    const encoder = new TextEncoder();
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
      const saltBytes = window.crypto.getRandomValues(new Uint8Array(32));
      const publicHashBytes = await generateCommitment(sessionScore, saltBytes);
      const args = [
        nativeToScVal(userAddress, { type: 'address' }),
        nativeToScVal(Number(sessionScore), { type: 'u32' }), 
        nativeToScVal(saltBytes, { type: 'bytes' }),
        nativeToScVal(publicHashBytes, { type: 'bytes' }),
        nativeToScVal(new Uint8Array(64), { type: 'bytes' })
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
      const albedoRes = await albedo.tx({ xdr: tx.toXDR(), network: 'testnet' });
      console.log("Submitting via Raw RPC...");
      const rpcResponse = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "sendTransaction",
          params: { transaction: albedoRes.signed_envelope_xdr }
        })
      });
      const rawResult = await rpcResponse.json();
      if (rawResult.error) throw new Error(rawResult.error.message);
      const txHash = rawResult.result.hash;
      console.log("Success! TX Hash:", txHash);

      let status = "PENDING";
      while (status === "PENDING" || status === "NOT_FOUND") {
        const poll = await server.getTransaction(txHash);
        status = poll.status;
        if (status === "SUCCESS") {
          setGameState('IDLE');
          fetchScores();
          break;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error("Frontend Error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => { fetchScores(); }, []);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentScores = scores.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(scores.length / itemsPerPage);

  return (
    <div className="dashboard-wrapper">
      <div className="outer-container">
        <div className="top-header">
          <div className="status-pill">LIVE ON TESTNET</div>
          <h1 className="main-title">ZK LEADERBOARD</h1>
        </div>

        <div className="glass-card">
          <div className="contract-display">
            CONTRACT: <span>{CONTRACT_ID}</span>
          </div>

          <div className="wallet-section">
            {userAddress ? (
              <span className="user-pill">{formatAddress(userAddress)}</span>
            ) : (
              <button onClick={connectWallet} className="connect-wallet-btn">CONNECT WALLET</button>
            )}
          </div>

          <div className="table-wrapper">
            <div className="table-header">
              <span className="col-rank">RANK</span>
              <span className="col-player">PLAYER</span>
              <span className="col-score">SCORE</span>
            </div>
            <div className="table-body">
              {loading ? (
                <div className="loading-state">Loading...</div>
              ) : currentScores.length > 0 ? (
                currentScores.map((s, i) => (
                  <div key={i} className="table-row">
                    <span className="col-rank">#{indexOfFirstItem + i + 1}</span>
                    <span className="col-player">{formatAddress(s.user)}</span>
                    <span className="col-score">{Number(s.score)}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">No rankings yet.</div>
              )}
            </div>
          </div>

          <div className="pagination-controls">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
              disabled={currentPage === 1}
              className="page-btn"
            >PREV</button>
            <span className="page-info">{currentPage} / {totalPages || 1}</span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
              disabled={currentPage === totalPages || totalPages === 0}
              className="page-btn active"
            >NEXT</button>
          </div>

          <div className="footer-actions">
            <button onClick={handleAction} className="main-action-btn" disabled={submitting}>
              {submitting ? 'VALIDATING...' : 
               !userAddress ? 'CONNECT TO PLAY' :
               gameState === 'IDLE' ? 'START NEW GAME' :
               gameState === 'PLAYING' ? 'FINISH GAME' : `SUBMIT SCORE (${sessionScore})`}
            </button>
            <button onClick={fetchScores} className="refresh-btn">Refresh Data</button>
          </div>
        </div>
      </div>

      <style>{`
        :root { --neon: #00ff88; --bg: #0b0b11; --card-bg: rgba(25, 25, 35, 0.4); --border: rgba(255, 255, 255, 0.08); }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background-color: var(--bg); color: white; }
        
        .dashboard-wrapper { 
          min-height: 100vh; 
          width: 100vw; 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          padding: 40px 20px; 
          overflow-x: hidden;
        }
        
        .outer-container { 
          width: 100%; 
          max-width: 800px; 
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .top-header { text-align: center; margin-bottom: 30px; }
        .status-pill { display: inline-block; background: var(--neon); color: black; font-size: 10px; font-weight: 900; padding: 4px 12px; border-radius: 50px; margin-bottom: 10px; text-transform: uppercase; }
        .main-title { font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
        
        .glass-card { 
          width: 100%;
          background: var(--card-bg); 
          border: 1px solid var(--border); 
          border-radius: 20px; 
          padding: 40px; 
          box-shadow: 0 20px 50px rgba(0,0,0,0.3); 
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .contract-display { font-size: 11px; color: #666; text-align: center; font-family: monospace; margin-bottom: 20px; overflow-wrap: break-word; width: 100%; }
        .contract-display span { color: var(--neon); }
        
        .wallet-section { display: flex; justify-content: center; margin-bottom: 30px; width: 100%; }
        .connect-wallet-btn { background: transparent; border: 1px solid var(--neon); color: var(--neon); padding: 8px 24px; border-radius: 6px; font-weight: 700; cursor: pointer; text-transform: uppercase; font-size: 14px; }
        .user-pill { color: var(--neon); font-family: monospace; font-weight: 700; border: 1px solid var(--neon); padding: 8px 16px; border-radius: 6px; }

        .table-wrapper { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 20px; background: rgba(0,0,0,0.2); width: 100%; }
        .table-header { display: grid; grid-template-columns: 80px 1fr 120px; padding: 15px 25px; color: #555; font-size: 12px; font-weight: 700; border-bottom: 1px solid var(--border); }
        .col-score { text-align: right; }
        
        .table-row { display: grid; grid-template-columns: 80px 1fr 120px; padding: 20px 25px; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.02); }
        .col-rank { color: #444; font-weight: 700; }
        .col-player { font-family: monospace; font-weight: 700; font-size: 14px; color: #ddd; }
        .table-row .col-score { color: var(--neon); font-size: 24px; font-weight: 900; }

        .pagination-controls { display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 30px; width: 100%; }
        .page-btn { background: #1a1a24; border: 1px solid var(--border); color: #444; padding: 6px 16px; border-radius: 4px; font-weight: 700; font-size: 12px; cursor: pointer; }
        .page-btn.active { color: white; border-color: #666; }
        .page-info { font-size: 12px; color: #555; font-weight: 700; }

        .footer-actions { display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%; }
        .main-action-btn { width: 100%; background: white; color: black; border: none; padding: 18px; border-radius: 12px; font-weight: 800; font-size: 16px; cursor: pointer; text-transform: uppercase; }
        .refresh-btn { background: none; border: none; color: #666; font-size: 12px; text-decoration: underline; cursor: pointer; }
        
        @media (max-width: 600px) {
          .glass-card { padding: 20px; }
          .table-header, .table-row { grid-template-columns: 50px 1fr 80px; padding: 15px; }
          .table-row .col-score { font-size: 18px; }
        }
      `}</style>
    </div>
  );
}

export default App;