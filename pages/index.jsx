import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import Head from 'next/head';
import FreeAIAssistant from '../components/FreeAIAssistant';

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

const playSound = (type, soundEnabled) => {
  if (!soundEnabled || typeof window === 'undefined') return;
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    switch(type) {
      case 'connect': oscillator.frequency.value = 800; gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.3); break;
      case 'success': oscillator.frequency.value = 1000; gainNode.gain.setValueAtTime(0.2, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.2); break;
      case 'achievement': oscillator.frequency.value = 1200; gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.5); break;
      case 'error': oscillator.frequency.value = 300; gainNode.gain.setValueAtTime(0.2, audioContext.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15); oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.15); break;
    }
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
  if (totalCommits >= 1) badges.push({ name: "First Commit", icon: "🎯", gradient: "from-blue-500 to-cyan-500" });
  if (streak >= 3) badges.push({ name: "3-Day Streak", icon: "🔥", gradient: "from-orange-500 to-red-500" });
  if (streak >= 7) badges.push({ name: "Week Warrior", icon: "⚡", gradient: "from-yellow-500 to-orange-500" });
  if (streak >= 30) badges.push({ name: "Month Master", icon: "👑", gradient: "from-purple-500 to-pink-500" });
  if (totalCommits >= 10) badges.push({ name: "Committed Builder", icon: "🏗️", gradient: "from-green-500 to-emerald-500" });
  if (isPuzzleSolved) badges.push({ name: "Puzzle Solver", icon: "🧩", gradient: "from-violet-500 to-purple-500" });
  return badges;
};

const Confetti = ({ show }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div key={i} className="absolute animate-confetti" style={{left: `${Math.random() * 100}%`, top: '-10px', animationDelay: `${Math.random() * 0.5}s`, animationDuration: `${2 + Math.random() * 2}s`}}>
          <div className="w-3 h-3 rounded-full" style={{backgroundColor: ['#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#10B981'][Math.floor(Math.random() * 5)]}} />
        </div>
      ))}
      <style jsx>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti linear forwards; }
      `}</style>
    </div>
  );
};

const Badge = ({ badge, isNew }) => (
  <div className={`badge bg-gradient-to-r ${badge.gradient} text-white ${isNew ? 'animate-bounce' : ''} relative`}>
    <span className="text-lg">{badge.icon}</span>
    <span>{badge.name}</span>
    {isNew && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-ping" />}
  </div>
);

export default function Home() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [commits, setCommits] = useState([]);
  const [userCommit, setUserCommit] = useState({ message: '', timestamp: 0 });
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [showBadge, setShowBadge] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);
  const [puzzleAnswer, setPuzzleAnswer] = useState('');
  const [puzzleSolved, setPuzzleSolved] = useState(() => {
    if (typeof window !== 'undefined') {
      const solved = localStorage.getItem(`puzzle_${getTodaysPuzzleIndex()}`);
      return solved === 'true';
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
    const streak = calculateStreak(commits, account);
    return { streak, totalCommits: userCommits.length };
  }, [account, commits]);

  const userAchievements = useMemo(() => {
    return getAchievements(userStats.streak, userStats.totalCommits, puzzleSolved);
  }, [userStats.streak, userStats.totalCommits, puzzleSolved]);

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
  }, [commits]);const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const ethersProvider = new ethers.BrowserProvider(window.ethereum);
        const signer = await ethersProvider.getSigner();
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setAccount(accounts[0]);
        setProvider(ethersProvider);
        setContract(contractInstance);
        playSound('connect', soundEnabled);
        try {
          await window.ethereum.request({method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }]});
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({method: 'wallet_addEthereumChain', params: [{chainId: '0x2105', chainName: 'Base', nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org']}]});
          }
        }
      } else {
        alert('Please install MetaMask!');
      }
    } catch (error) {
      console.error('Connection error:', error);
      playSound('error', soundEnabled);
    }
  };

  const fetchCommits = useCallback(async () => {
    try {
      const readProvider = new ethers.JsonRpcProvider(BASE_RPC);
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
      const filter = readContract.filters.CommitSet();
      const events = await readContract.queryFilter(filter, 0, 'latest');
      const commitMap = new Map();
      for (const event of events) {
        const user = event.args.user;
        const message = event.args.message;
        const timestamp = Number(event.args.timestamp);
        const txHash = event.transactionHash;
        const clearFilter = readContract.filters.CommitCleared(user);
        const clearEvents = await readContract.queryFilter(clearFilter, event.blockNumber, 'latest');
        const wasCleared = clearEvents.some(ce => Number(ce.args.timestamp) > timestamp);
        if (!wasCleared) {
          commitMap.set(user.toLowerCase(), { user, message, timestamp, blockNumber: event.blockNumber, txHash });
        }
      }
      const commitsArray = Array.from(commitMap.values()).sort((a, b) => b.timestamp - a.timestamp);
      setCommits(commitsArray);
    } catch (error) {
      console.error('Error fetching commits:', error);
    }
  }, []);

  const fetchUserCommit = useCallback(async () => {
    if (!contract || !account) return;
    try {
      const [message, timestamp] = await contract.getCommit(account);
      setUserCommit({ message, timestamp: Number(timestamp) });
    } catch (error) {
      console.error('Error fetching user commit:', error);
    }
  }, [contract, account]);

  const checkNewAchievements = useCallback((oldStats, newStats, wasPuzzleSolved) => {
    const oldAchievements = getAchievements(oldStats.streak, oldStats.totalCommits, wasPuzzleSolved);
    const newAchievementsData = getAchievements(newStats.streak, newStats.totalCommits, puzzleSolved);
    const newBadges = newAchievementsData.filter(badge => !oldAchievements.some(old => old.name === badge.name));
    if (newBadges.length > 0) {
      setNewAchievements(newBadges);
      setShowConfetti(true);
      playSound('achievement', soundEnabled);
      setTimeout(() => {
        setShowConfetti(false);
        setNewAchievements([]);
      }, 5000);
    }
  }, [puzzleSolved, soundEnabled]);

  const submitCommit = async () => {
    if (!contract || !newMessage.trim()) return;
    const oldStats = { ...userStats };
    setLoading(true);
    setTxStatus('⏳ Sending transaction...');
    try {
      const tx = await contract.setCommit(newMessage);
      setTxStatus('⏳ Confirming on Base...');
      await tx.wait();
      setTxStatus('✅ Success!');
      setShowBadge(true);
      playSound('success', soundEnabled);
      setTimeout(() => setShowBadge(false), 3000);
      setNewMessage('');
      await fetchUserCommit();
      await fetchCommits();
      setTimeout(() => {
        const newStats = {
          streak: calculateStreak(commits, account),
          totalCommits: commits.filter(c => c.user.toLowerCase() === account.toLowerCase()).length
        };
        checkNewAchievements(oldStats, newStats, false);
      }, 1000);
      setTimeout(() => setTxStatus(''), 3000);
    } catch (error) {
      console.error('Error submitting commit:', error);
      setTxStatus('❌ Error: ' + error.message.slice(0, 50));
      playSound('error', soundEnabled);
      setTimeout(() => setTxStatus(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const clearCommit = async () => {
    if (!contract) return;
    setLoading(true);
    setTxStatus('⏳ Clearing...');
    try {
      const tx = await contract.clearCommit();
      setTxStatus('⏳ Confirming...');
      await tx.wait();
      setTxStatus('✅ Cleared!');
      playSound('success', soundEnabled);
      await fetchUserCommit();
      await fetchCommits();
      setTimeout(() => setTxStatus(''), 3000);
    } catch (error) {
      console.error('Error clearing commit:', error);
      setTxStatus('❌ Error: ' + error.message.slice(0, 50));
      playSound('error', soundEnabled);
      setTimeout(() => setTxStatus(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const solvePuzzle = () => {
    const userAnswer = puzzleAnswer.toLowerCase().trim();
    const correctAnswer = todaysPuzzle.answer.toLowerCase();
    if (userAnswer === correctAnswer || userAnswer.includes(correctAnswer) || correctAnswer.includes(userAnswer)) {
      setPuzzleSolved(true);
      localStorage.setItem(`puzzle_${getTodaysPuzzleIndex()}`, 'true');
      setPuzzleAnswer('');
      setShowPuzzleHint(false);
      setShowConfetti(true);
      playSound('achievement', soundEnabled);
      setTimeout(() => setShowConfetti(false), 3000);
      const currentAchievements = getAchievements(userStats.streak, userStats.totalCommits, false);
      const newAchievementsWithPuzzle = getAchievements(userStats.streak, userStats.totalCommits, true);
      const puzzleBadge = newAchievementsWithPuzzle.find(a => a.name === "Puzzle Solver");
      if (puzzleBadge && !currentAchievements.some(a => a.name === "Puzzle Solver")) {
        setNewAchievements([puzzleBadge]);
        setTimeout(() => setNewAchievements([]), 5000);
      }
    } else {
      setTxStatus('❌ Not quite! Try again.');
      playSound('error', soundEnabled);
      setTimeout(() => setTxStatus(''), 3000);
    }
  };

  useEffect(() => {
    fetchCommits();
    const interval = setInterval(fetchCommits, 15000);
    return () => clearInterval(interval);
  }, [fetchCommits]);

  useEffect(() => {
    if (contract && account) {
      fetchUserCommit();
    }
  }, [contract, account, fetchUserCommit]);

  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatTimestamp = (ts) => new Date(ts * 1000).toLocaleString();

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Head>
        <title>Base Agent - Builder Intent Onchain</title>
        <meta name="description" content="Track builder commitments on Base blockchain" />
      </Head>

      <Confetti show={showConfetti} />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        
        <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Base Agent</h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Builder Intent Onchain</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {showLeaderboard && (
                  <button 
                    onClick={() => setShowLeaderboard(false)} 
                    className="hidden lg:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    <span>🏆</span>
                    <span>Top 5</span>
                  </button>
                )}
                {!showLeaderboard && leaderboard.length > 0 && (
                  <button 
                    onClick={() => setShowLeaderboard(true)} 
                    className="hidden lg:flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  >
                    <span>🏆</span>
                    <span>Leaderboard</span>
                  </button>
                )}
                <button 
                  onClick={() => setSoundEnabled(!soundEnabled)} 
                  className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                  title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                >
                  <span className="text-lg">{soundEnabled ? '🔊' : '🔇'}</span>
                </button>
                <button 
                  onClick={() => setDarkMode(!darkMode)} 
                  className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  <span className="text-lg">{darkMode ? '☀️' : '🌙'}</span>
                </button>
                {!account ? (
                  <button 
                    onClick={connectWallet} 
                    className="btn-primary"
                  >
                    Connect Wallet
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-500 dark:border-green-400 rounded-xl text-green-700 dark:text-green-400 font-bold text-sm">
                    {formatAddress(account)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {newAchievements.length > 0 && (
            <div className="fixed top-24 right-4 z-50 animate-slide-up">
              <div className="card p-4 border-2 border-blue-500 shadow-2xl max-w-sm">
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">🎉 Achievement Unlocked!</p>
                <div className="flex flex-wrap gap-2">
                  {newAchievements.map((badge, i) => (
                    <Badge key={i} badge={badge} isNew={true} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 space-y-6">
              {account && (
                <>
                  <div className="card p-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Commitment</h2>
                      {showBadge && (
                        <div className="animate-bounce bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                          Submitted! 🎉
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-700">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                          <p className="text-5xl font-black text-blue-600 dark:text-blue-400 mb-1">{userStats.streak}</p>
                          <p className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400 font-semibold">Day Streak 🔥</p>
                        </div>
                        <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                          <p className="text-5xl font-black text-green-600 dark:text-green-400 mb-1">{userStats.totalCommits}</p>
                          <p className="text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400 font-semibold">Total Commits</p>
                        </div>
                      </div>
                      {userAchievements.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {userAchievements.map((badge, i) => (
                            <Badge key={i} badge={badge} isNew={false} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mb-6">
                      <FreeAIAssistant onCommitGenerated={(commit) => setNewMessage(commit)} />
                    </div>

                    {userCommit.message && (
                      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl">
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">Current Commitment:</p>
                        <p className="text-gray-900 dark:text-white font-medium mb-2">{userCommit.message}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Last updated: {formatTimestamp(userCommit.timestamp)}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                        Your Message:
                      </label>
                      <textarea 
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        placeholder="Write your commitment or use AI suggestions above..." 
                        className="input resize-none"
                        rows="4" 
                        disabled={loading} 
                      />
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button 
                        onClick={submitCommit} 
                        disabled={loading || !newMessage.trim()} 
                        className="flex-1 btn-primary text-lg"
                      >
                        {loading ? '⏳ Processing...' : userCommit.message ? '🔄 Update' : '✅ Submit'}
                      </button>
                      {userCommit.message && (
                        <button 
                          onClick={clearCommit} 
                          disabled={loading} 
                          className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50"
                        >
                          🗑️ Clear
                        </button>
                      )}
                    </div>

                    {txStatus && (
                      <div className={`mt-4 p-4 rounded-xl text-sm font-semibold ${txStatus.includes('Error') || txStatus.includes('❌') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-2 border-red-200 dark:border-red-700' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-2 border-green-200 dark:border-green-700'}`}>
                        {txStatus}
                      </div>
                    )}
                  </div><div className="card p-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>🧩</span>
                        <span>Daily Puzzle</span>
                      </h2>
                      {puzzleSolved && (
                        <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full shadow-lg">
                          SOLVED ✓
                        </span>
                      )}
                    </div>
                    
                    {!puzzleSolved ? (
                      <>
                        <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">{todaysPuzzle.question}</p>
                        
                        <input 
                          type="text" 
                          value={puzzleAnswer} 
                          onChange={(e) => setPuzzleAnswer(e.target.value)} 
                          placeholder="Your answer..." 
                          className="input mb-3"
                          onKeyPress={(e) => e.key === 'Enter' && solvePuzzle()} 
                        />
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={solvePuzzle} 
                            className="flex-1 btn-primary"
                          >
                            ✅ Submit Answer
                          </button>
                          <button 
                            onClick={() => setShowPuzzleHint(!showPuzzleHint)} 
                            className="px-4 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                          >
                            💡 Hint
                          </button>
                        </div>
                        
                        {showPuzzleHint && (
                          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl animate-fade-in">
                            <p className="text-sm text-yellow-800 dark:text-yellow-300 font-semibold">💡 {todaysPuzzle.hint}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-6xl mb-3 animate-bounce">🎉</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">Puzzle Complete!</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Come back tomorrow for a new challenge</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-6">
              {showLeaderboard && leaderboard.length > 0 && (
                <div className="card p-6 animate-fade-in">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span>🏆</span>
                    <span>Top Builders</span>
                  </h2>
                  <div className="space-y-3">
                    {leaderboard.map((user, i) => (
                      <div 
                        key={user.address} 
                        className={`p-4 rounded-xl transition-all hover:scale-105 ${
                          i === 0 
                            ? 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-2 border-yellow-400 dark:border-yellow-600 shadow-lg' 
                            : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐'}</span>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{formatAddress(user.address)}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{user.commits} commits</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{user.streak}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">🔥 streak</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Live Feed</h2>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                <span className="text-gray-600 dark:text-gray-400 font-semibold">{commits.length} Active</span>
              </div>
            </div>

            {commits.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">No commitments yet</p>
                <p className="text-gray-600 dark:text-gray-400">Be the first to commit!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {commits.map((commit, idx) => (
                  <div 
                    key={commit.user} 
                    className="card p-5 cursor-pointer hover:scale-[1.02] transition-all animate-fade-in" 
                    style={{ animationDelay: `${idx * 50}ms` }} 
                    onClick={() => setExpandedCard(expandedCard === commit.user ? null : commit.user)}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg"
                        style={{ 
                          backgroundColor: ['#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#10B981'][parseInt(commit.user.slice(2, 8), 16) % 5]
                        }}
                      >
                        {commit.user.slice(2, 4).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-gray-900 dark:text-white text-sm">{formatAddress(commit.user)}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(commit.timestamp * 1000).toLocaleDateString()}</span>
                        </div>
                        
                        <p className={`text-gray-700 dark:text-gray-300 leading-relaxed ${expandedCard === commit.user ? '' : 'line-clamp-2'}`}>
                          {commit.message}
                        </p>
                        
                        {expandedCard === commit.user && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 animate-fade-in">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-bold">Time:</span> {formatTimestamp(commit.timestamp)}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <a 
                                href={`https://basescan.org/address/${commit.user}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold" 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>View Address</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                              {commit.txHash && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <a 
                                    href={`https://basescan.org/tx/${commit.txHash}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold" 
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span>View TX</span>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="mt-16 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              <p className="font-semibold">Built on Base ⛓️</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
                    }
