import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import Head from 'next/head';

const CONTRACT_ADDRESS = '0x3bA728E41d754200c1717c652Fd3dF6e433e80E4';
const CONTRACT_ABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"CommitCleared","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"string","name":"message","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"CommitSet","type":"event"},{"inputs":[],"name":"clearCommit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getCommit","outputs":[{"internalType":"string","name":"message","type":"string"},{"internalType":"uint256","name":"updatedAt","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"message","type":"string"}],"name":"setCommit","outputs":[],"stateMutability":"nonpayable","type":"function"}];
const BASE_RPC = 'https://mainnet.base.org';

const DAILY_PUZZLES = [
  { question: "I am taken from a mine and shut up in a wooden case. I am never released, yet I am used by almost everybody. What am I?", answer: "pencil lead", hint: "Think about writing..." },
  { question: "What has keys but no locks, space but no room, and you can enter but can't go inside?", answer: "keyboard", hint: "You're using one right now..." },
  { question: "The more you take, the more you leave behind. What am I?", answer: "footsteps", hint: "Think about walking..." },
  { question: "What can travel around the world while staying in a corner?", answer: "stamp", hint: "Think about mail..." },
  { question: "I have cities but no houses, forests but no trees, and water but no fish. What am I?", answer: "map", hint: "Think about geography..." },
  { question: "What comes once in a minute, twice in a moment, but never in a thousand years?", answer: "letter m", hint: "Think literally..." },
  { question: "What gets wetter the more it dries?", answer: "towel", hint: "Think about bathrooms..." }
];

const playSound = (type, enabled) => {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const freq = {connect: 800, success: 1000, achievement: 1200, error: 300}[type] || 800;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
};

const getTodaysPuzzleIndex = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  return dayOfYear % DAILY_PUZZLES.length;
};

const calculateStreak = (commits, userAddress) => {
  if (!commits || !userAddress) return 0;
  const userCommits = commits.filter(c => c.user.toLowerCase() === userAddress.toLowerCase()).sort((a, b) => b.timestamp - a.timestamp);
  if (userCommits.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < userCommits.length; i++) {
    const commitDate = new Date(userCommits[i].timestamp * 1000);
    commitDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - commitDate) / 86400000);
    if (daysDiff === streak) streak++;
    else if (daysDiff > streak) break;
  }
  return streak;
};

const getAchievements = (streak, totalCommits, isPuzzleSolved) => {
  const badges = [];
  if (totalCommits >= 1) badges.push({ name: "First Commit", icon: "🎯" });
  if (streak >= 3) badges.push({ name: "3-Day Streak", icon: "🔥" });
  if (streak >= 7) badges.push({ name: "Week Warrior", icon: "⚡" });
  if (streak >= 30) badges.push({ name: "Month Master", icon: "👑" });
  if (totalCommits >= 10) badges.push({ name: "Committed Builder", icon: "🏗️" });
  if (isPuzzleSolved) badges.push({ name: "Puzzle Solver", icon: "🧩" });
  return badges;
};

const Confetti = ({ show }) => {
  if (!show) return null;
  return (
    <div style={{position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden'}}>
      {[...Array(50)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${Math.random() * 100}%`,
          top: '-10px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: ['#0052FF', '#FF6B6B', '#FFD93D', '#6BCF7F', '#A78BFA'][i % 5],
          animation: `fall ${2 + Math.random() * 2}s linear forwards`,
          animationDelay: `${Math.random() * 0.5}s`
        }} />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default function Home() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [commits, setCommits] = useState([]);
  const [userCommit, setUserCommit] = useState({ message: '', timestamp: 0 });
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);
  const [puzzleAnswer, setPuzzleAnswer] = useState('');
  const [puzzleSolved, setPuzzleSolved] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`puzzle_${getTodaysPuzzleIndex()}`) === 'true';
    }
    return false;
  });
  const [showPuzzleHint, setShowPuzzleHint] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const todaysPuzzle = DAILY_PUZZLES[getTodaysPuzzleIndex()];

  const userStats = useMemo(() => {
    if (!account || !commits.length) return { streak: 0, totalCommits: 0 };
    const userCommits = commits.filter(c => c.user.toLowerCase() === account.toLowerCase());
    return { streak: calculateStreak(commits, account), totalCommits: userCommits.length };
  }, [account, commits]);

  const userAchievements = useMemo(() => {
    return getAchievements(userStats.streak, userStats.totalCommits, puzzleSolved);
  }, [userStats, puzzleSolved]);

  const leaderboard = useMemo(() => {
    const userMap = new Map();
    commits.forEach(commit => {
      const addr = commit.user.toLowerCase();
      if (!userMap.has(addr)) userMap.set(addr, { address: commit.user, commits: 0, streak: 0 });
      userMap.get(addr).commits++;
    });
    userMap.forEach((data, addr) => {
      data.streak = calculateStreak(commits, addr);
    });
    return Array.from(userMap.values()).sort((a, b) => (b.streak * 10 + b.commits) - (a.streak * 10 + a.commits)).slice(0, 5);
  }, [commits]);

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setAccount(accounts[0]);
        setContract(contractInstance);
        playSound('connect', soundEnabled);
        try {
          await window.ethereum.request({method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }]});
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({method: 'wallet_addEthereumChain', params: [{chainId: '0x2105', chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org']}]});
          }
        }
      } else {
        alert('Please install MetaMask!');
      }
    } catch (error) {
      console.error(error);
      playSound('error', soundEnabled);
    }
  };

  const fetchCommits = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const filter = contract.filters.CommitSet();
      const events = await contract.queryFilter(filter, 0, 'latest');
      const commitMap = new Map();
      for (const event of events) {
        const user = event.args.user;
        const message = event.args.message;
        const timestamp = Number(event.args.timestamp);
        const txHash = event.transactionHash;
        const clearFilter = contract.filters.CommitCleared(user);
        const clearEvents = await contract.queryFilter(clearFilter, event.blockNumber, 'latest');
        const wasCleared = clearEvents.some(ce => Number(ce.args.timestamp) > timestamp);
        if (!wasCleared) {
          commitMap.set(user.toLowerCase(), { user, message, timestamp, txHash });
        }
      }
      setCommits(Array.from(commitMap.values()).sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchUserCommit = useCallback(async () => {
    if (!contract || !account) return;
    try {
      const [message, timestamp] = await contract.getCommit(account);
      setUserCommit({ message, timestamp: Number(timestamp) });
    } catch (error) {
      console.error(error);
    }
  }, [contract, account]);

  const submitCommit = async () => {
    if (!contract || !newMessage.trim()) return;
    setLoading(true);
    setTxStatus('⏳ Sending...');
    try {
      const tx = await contract.setCommit(newMessage);
      setTxStatus('⏳ Confirming...');
      await tx.wait();
      setTxStatus('✅ Success!');
      playSound('success', soundEnabled);
      setNewMessage('');
      await fetchUserCommit();
      await fetchCommits();
      setTimeout(() => setTxStatus(''), 3000);
    } catch (error) {
      setTxStatus('❌ Error');
      playSound('error', soundEnabled);
      setTimeout(() => setTxStatus(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const clearCommit = async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const tx = await contract.clearCommit();
      await tx.wait();
      playSound('success', soundEnabled);
      await fetchUserCommit();
      await fetchCommits();
    } catch (error) {
      playSound('error', soundEnabled);
    } finally {
      setLoading(false);
    }
  };

  const solvePuzzle = () => {
    const userAnswer = puzzleAnswer.toLowerCase().trim();
    const correctAnswer = todaysPuzzle.answer.toLowerCase();
    if (userAnswer === correctAnswer || userAnswer.includes(correctAnswer)) {
      setPuzzleSolved(true);
      localStorage.setItem(`puzzle_${getTodaysPuzzleIndex()}`, 'true');
      setPuzzleAnswer('');
      setShowPuzzleHint(false);
      setShowConfetti(true);
      playSound('achievement', soundEnabled);
      setTimeout(() => setShowConfetti(false), 3000);
    } else {
      playSound('error', soundEnabled);
    }
  };

  useEffect(() => {
    fetchCommits();
    const interval = setInterval(fetchCommits, 15000);
    return () => clearInterval(interval);
  }, [fetchCommits]);

  useEffect(() => {
    if (contract && account) fetchUserCommit();
  }, [contract, account, fetchUserCommit]);

  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const bg = darkMode ? '#111827' : '#FFFFFF';
  const cardBg = darkMode ? '#1F2937' : '#FFFFFF';
  const text = darkMode ? '#F9FAFB' : '#111827';
  const textGray = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? '#374151' : '#E5E7EB';

  const buttonStyle = {
    padding: '20px 32px',
    fontSize: '18px',
    fontWeight: '700',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s',
    background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)',
    color: '#FFF',
    boxShadow: '0 8px 24px rgba(0, 82, 255, 0.3)',
  };

  const cardStyle = {
    background: cardBg,
    borderRadius: '24px',
    padding: '40px',
    marginBottom: '40px',
    border: `3px solid ${border}`,
    boxShadow: darkMode ? '0 0 40px rgba(59, 130, 246, 0.3)' : '0 4px 24px rgba(0, 0, 0, 0.08)',
    animation: 'glow 3s ease-in-out infinite',
  };

  const inputStyle = {
    width: '100%',
    padding: '20px',
    fontSize: '16px',
    borderRadius: '16px',
    border: `3px solid ${border}`,
    background: cardBg,
    color: text,
    marginBottom: '24px',
    boxShadow: darkMode ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
    transition: 'all 0.3s',
  };

  return (
    <div style={{minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, -apple-system, sans-serif', transition: 'all 0.3s'}}>
      <Head>
        <title>Base Agent</title>
        <meta name="base:app_id" content="6984513a4609f1d788ad2b9a" />
      </Head>

      <Confetti show={showConfetti} />

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 50px rgba(59, 130, 246, 0.6); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        button:hover { transform: scale(1.05); filter: brightness(1.1); }
        button:active { transform: scale(0.98); }
      `}</style>

      <div style={{borderBottom: `2px solid ${border}`, padding: '24px', background: cardBg}}>
        <div style={{maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
            <div style={{width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #0052FF, #0041CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px'}}>🤖</div>
            <div>
              <h1 style={{fontSize: '32px', fontWeight: '900', marginBottom: '4px'}}>Base Agent</h1>
              <p style={{color: textGray, fontSize: '14px'}}>Builder Intent Onchain</p>
            </div>
          </div>
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <button onClick={() => setShowLeaderboard(!showLeaderboard)} style={{...buttonStyle, background: 'linear-gradient(135deg, #F59E0B, #D97706)', padding: '16px 24px'}}>
              🏆 Top 5
            </button>
            <button onClick={() => setSoundEnabled(!soundEnabled)} style={{...buttonStyle, background: darkMode ? '#374151' : '#E5E7EB', color: text, padding: '16px', fontSize: '24px'}}>
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} style={{...buttonStyle, background: darkMode ? '#374151' : '#E5E7EB', color: text, padding: '16px', fontSize: '24px'}}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            {!account ? (
              <button onClick={connectWallet} style={buttonStyle}>Connect Wallet</button>
            ) : (
              <div style={{...buttonStyle, background: 'linear-gradient(135deg, #10B981, #059669)'}}>{formatAddress(account)}</div>
            )}
          </div>
        </div>
      </div>

      <div style={{maxWidth: '1400px', margin: '0 auto', padding: '48px 24px'}}>
        
        {newAchievements.length > 0 && (
          <div style={{position: 'fixed', top: '100px', right: '24px', zIndex: 9999, ...cardStyle, padding: '24px', maxWidth: '400px'}}>
            <p style={{fontSize: '18px', fontWeight: '700', marginBottom: '16px'}}>🎉 Achievement Unlocked!</p>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '12px'}}>
              {newAchievements.map((badge, i) => (
                <div key={i} style={{background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', padding: '12px 20px', borderRadius: '999px', color: '#FFF', fontWeight: '700', fontSize: '16px'}}>
                  <span style={{marginRight: '8px'}}>{badge.icon}</span>
                  {badge.name}
                </div>
              ))}
            </div>
          </div>
        )}
  <div style={{display: 'grid', gridTemplateColumns: showLeaderboard ? 'repeat(auto-fit, minmax(500px, 1fr))' : '1fr', gap: '48px'}}>
          
          <div>
            {account && (
              <>
                <div style={cardStyle}>
                  <h2 style={{fontSize: '28px', fontWeight: '900', marginBottom: '32px'}}>Your Stats</h2>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px'}}>
                    <div style={{textAlign: 'center', padding: '32px', background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)', borderRadius: '20px'}}>
                      <p style={{fontSize: '64px', fontWeight: '900', color: '#0052FF', marginBottom: '8px'}}>{userStats.streak}</p>
                      <p style={{fontSize: '14px', fontWeight: '700', color: '#1F2937', textTransform: 'uppercase'}}>Day Streak 🔥</p>
                    </div>
                    <div style={{textAlign: 'center', padding: '32px', background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', borderRadius: '20px'}}>
                      <p style={{fontSize: '64px', fontWeight: '900', color: '#10B981', marginBottom: '8px'}}>{userStats.totalCommits}</p>
                      <p style={{fontSize: '14px', fontWeight: '700', color: '#1F2937', textTransform: 'uppercase'}}>Total Commits</p>
                    </div>
                  </div>
                  {userAchievements.length > 0 && (
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '16px'}}>
                      {userAchievements.map((badge, i) => (
                        <div key={i} style={{background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)', padding: '14px 24px', borderRadius: '999px', color: '#FFF', fontWeight: '700', fontSize: '16px', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'}}>
                          <span style={{marginRight: '8px', fontSize: '20px'}}>{badge.icon}</span>
                          {badge.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={cardStyle}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px'}}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
                      animation: 'pulse 2s ease-in-out infinite'
                    }}>✨</div>
                    <h2 style={{fontSize: '28px', fontWeight: '900'}}>AI Commit Helper</h2>
                  </div>

                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '32px'}}>
                    {[
                      {label: 'DeFi', gradient: 'linear-gradient(135deg, #10B981, #059669)', shadow: 'rgba(16, 185, 129, 0.4)', msg: 'Building a decentralized lending protocol on Base for accessible finance'},
                      {label: 'NFT', gradient: 'linear-gradient(135deg, #EC4899, #DB2777)', shadow: 'rgba(236, 72, 153, 0.4)', msg: 'Launching an NFT marketplace with zero gas minting on Base'},
                      {label: 'DAO', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', shadow: 'rgba(139, 92, 246, 0.4)', msg: 'Developing DAO governance tools for decentralized decision-making on Base'},
                      {label: 'Tools', gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)', shadow: 'rgba(59, 130, 246, 0.4)', msg: 'Building developer tools to accelerate Base ecosystem growth'},
                      {label: 'Social', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', shadow: 'rgba(245, 158, 11, 0.4)', msg: 'Building onchain social networks for authentic community engagement on Base'},
                      {label: 'Gaming', gradient: 'linear-gradient(135deg, #A78BFA, #8B5CF6)', shadow: 'rgba(167, 139, 250, 0.4)', msg: 'Building onchain games with true asset ownership on Base'}
                    ].map((btn, idx) => (
                      <button
                        key={idx}
                        onClick={() => setNewMessage(btn.msg)}
                        style={{
                          padding: '16px 28px',
                          fontSize: '16px',
                          fontWeight: '700',
                          borderRadius: '12px',
                          border: 'none',
                          cursor: 'pointer',
                          background: btn.gradient,
                          color: '#FFF',
                          boxShadow: `0 4px 16px ${btn.shadow}`,
                          transition: 'all 0.3s',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = `0 8px 24px ${btn.shadow}`;
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = `0 4px 16px ${btn.shadow}`;
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <p style={{color: textGray, fontSize: '14px', marginBottom: '16px', fontWeight: '600'}}>
                    Click a category above or write your own:
                  </p>
                </div>

                <div style={cardStyle}>
                  <h2 style={{fontSize: '28px', fontWeight: '900', marginBottom: '32px'}}>Your Commitment</h2>
                  
                  {userCommit.message && (
                    <div style={{background: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)', padding: '24px', borderRadius: '16px', marginBottom: '32px', border: '3px solid #3B82F6'}}>
                      <p style={{fontWeight: '700', color: '#1E40AF', marginBottom: '12px'}}>Current:</p>
                      <p style={{fontSize: '16px', color: '#1F2937', lineHeight: '1.6'}}>{userCommit.message}</p>
                    </div>
                  )}

                  <textarea 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder="Write your commitment..." 
                    style={{...inputStyle, minHeight: '120px', resize: 'vertical'}}
                    disabled={loading} 
                  />

                  <div style={{display: 'flex', gap: '16px', marginTop: '24px'}}>
                    <button onClick={submitCommit} disabled={loading || !newMessage.trim()} style={{...buttonStyle, flex: 1}} onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 82, 255, 0.5)'} onMouseOut={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 82, 255, 0.3)'}>
                      {loading ? '⏳ Processing...' : '✅ SUBMIT'}
                    </button>
                    {userCommit.message && (
                      <button onClick={clearCommit} disabled={loading} style={{...buttonStyle, background: 'linear-gradient(135deg, #EF4444, #DC2626)'}}>
                        🗑️ CLEAR
                      </button>
                    )}
                  </div>

                  {txStatus && (
                    <div style={{marginTop: '24px', padding: '20px', borderRadius: '16px', background: txStatus.includes('❌') ? '#FEE2E2' : '#D1FAE5', border: `3px solid ${txStatus.includes('❌') ? '#EF4444' : '#10B981'}`, fontWeight: '700', fontSize: '16px', color: txStatus.includes('❌') ? '#991B1B' : '#065F46'}}>
                      {txStatus}
                    </div>
                  )}
                </div><div style={cardStyle}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px'}}>
                    <h2 style={{fontSize: '28px', fontWeight: '900'}}>🧩 Daily Puzzle</h2>
                    {puzzleSolved && (
                      <div style={{background: 'linear-gradient(135deg, #10B981, #059669)', padding: '12px 24px', borderRadius: '999px', color: '#FFF', fontWeight: '700'}}>
                        SOLVED ✓
                      </div>
                    )}
                  </div>
                  
                  {!puzzleSolved ? (
                    <>
                      <p style={{fontSize: '18px', lineHeight: '1.6', marginBottom: '32px'}}>{todaysPuzzle.question}</p>
                      
                      <input 
                        type="text" 
                        value={puzzleAnswer} 
                        onChange={(e) => setPuzzleAnswer(e.target.value)} 
                        placeholder="Your answer..." 
                        style={inputStyle}
                        onKeyPress={(e) => e.key === 'Enter' && solvePuzzle()} 
                      />
                      
                      <div style={{display: 'flex', gap: '16px'}}>
                        <button onClick={solvePuzzle} style={{...buttonStyle, flex: 1}}>
                          ✅ SUBMIT
                        </button>
                        <button onClick={() => setShowPuzzleHint(!showPuzzleHint)} style={{...buttonStyle, background: 'linear-gradient(135deg, #F59E0B, #D97706)'}}>
                          💡 HINT
                        </button>
                      </div>
                      
                      {showPuzzleHint && (
                        <div style={{marginTop: '24px', padding: '20px', borderRadius: '16px', background: '#FEF3C7', border: '3px solid #F59E0B', fontWeight: '700', color: '#92400E'}}>
                          💡 {todaysPuzzle.hint}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{textAlign: 'center', padding: '48px 0'}}>
                      <p style={{fontSize: '72px', marginBottom: '16px'}}>🎉</p>
                      <p style={{fontSize: '32px', fontWeight: '900', color: '#10B981', marginBottom: '12px'}}>Puzzle Complete!</p>
                      <p style={{color: textGray}}>Come back tomorrow</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {showLeaderboard && leaderboard.length > 0 && (
            <div style={cardStyle}>
              <h2 style={{fontSize: '28px', fontWeight: '900', marginBottom: '32px'}}>🏆 Top Builders</h2>
              <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
                {leaderboard.map((user, i) => (
                  <div key={user.address} style={{
                    padding: '24px',
                    borderRadius: '16px',
                    background: i === 0 ? 'linear-gradient(135deg, #FEF3C7, #FDE68A)' : cardBg,
                    border: `3px solid ${i === 0 ? '#F59E0B' : border}`,
                    boxShadow: i === 0 ? '0 8px 24px rgba(245, 158, 11, 0.3)' : 'none'
                  }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                        <span style={{fontSize: '32px'}}>{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐'}</span>
                        <div>
                          <p style={{fontWeight: '900', fontSize: '18px', marginBottom: '4px'}}>{formatAddress(user.address)}</p>
                          <p style={{color: textGray, fontSize: '14px'}}>{user.commits} commits</p>
                        </div>
                      </div>
                      <div style={{textAlign: 'right'}}>
                        <p style={{fontSize: '36px', fontWeight: '900', color: '#0052FF'}}>{user.streak}</p>
                        <p style={{color: textGray, fontSize: '14px'}}>🔥 streak</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{marginTop: '64px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px'}}>
            <h2 style={{fontSize: '36px', fontWeight: '900'}}>Live Feed</h2>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 12px #10B981'}} />
              <span style={{fontWeight: '700', color: textGray}}>{commits.length} Active</span>
            </div>
          </div>

          {commits.length === 0 ? (
            <div style={{...cardStyle, textAlign: 'center', padding: '80px'}}>
              <p style={{fontSize: '72px', marginBottom: '24px'}}>📝</p>
              <p style={{fontSize: '24px', fontWeight: '900', marginBottom: '12px'}}>No commitments yet</p>
              <p style={{color: textGray}}>Be the first to commit!</p>
            </div>
          ) : (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: '32px'}}>
              {commits.map((commit) => (
                <div 
                  key={commit.user} 
                  style={{...cardStyle, cursor: 'pointer', padding: '32px'}}
                  onClick={() => setExpandedCard(expandedCard === commit.user ? null : commit.user)}
                >
                  <div style={{display: 'flex', gap: '20px'}}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${['#0052FF', '#EF4444', '#F59E0B', '#8B5CF6', '#10B981'][parseInt(commit.user.slice(2, 8), 16) % 5]}, ${['#0041CC', '#DC2626', '#D97706', '#7C3AED', '#059669'][parseInt(commit.user.slice(2, 8), 16) % 5]})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFF',
                      fontWeight: '900',
                      fontSize: '18px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                    }}>
                      {commit.user.slice(2, 4).toUpperCase()}
                    </div>
                    <div style={{flex: 1}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '12px'}}>
                        <span style={{fontWeight: '900', fontSize: '16px'}}>{formatAddress(commit.user)}</span>
                        <span style={{color: textGray, fontSize: '14px'}}>{new Date(commit.timestamp * 1000).toLocaleDateString()}</span>
                      </div>
                      <p style={{lineHeight: '1.6', fontSize: '16px'}}>{commit.message}</p>
                      
                      {expandedCard === commit.user && commit.txHash && (
                        <div style={{marginTop: '20px', paddingTop: '20px', borderTop: `2px solid ${border}`}}>
                          <a href={`https://basescan.org/tx/${commit.txHash}`} target="_blank" rel="noopener noreferrer" style={{color: '#0052FF', fontWeight: '700', textDecoration: 'none', fontSize: '14px'}}>
                            View Transaction →
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
