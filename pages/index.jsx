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
  if (totalCommits >= 1) badges.push({ name: "First Commit", icon: "🎯", color: "#0052FF" });
  if (streak >= 3) badges.push({ name: "3-Day Streak", icon: "🔥", color: "#FF6B6B" });
  if (streak >= 7) badges.push({ name: "Week Warrior", icon: "⚡", color: "#F59E0B" });
  if (streak >= 30) badges.push({ name: "Month Master", icon: "👑", color: "#A855F7" });
  if (totalCommits >= 10) badges.push({ name: "Committed Builder", icon: "🏗️", color: "#00D4AA" });
  if (isPuzzleSolved) badges.push({ name: "Puzzle Solver", icon: "🧩", color: "#8B5CF6" });
  return badges;
};

const Confetti = ({ show }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div key={i} className="absolute animate-confetti" style={{left: `${Math.random() * 100}%`, top: '-10px', animationDelay: `${Math.random() * 0.5}s`, animationDuration: `${2 + Math.random() * 2}s`}}>
          <div className="w-2 h-2 rounded-full" style={{backgroundColor: ['#0052FF', '#FF6B6B', '#F59E0B', '#A855F7', '#00D4AA'][Math.floor(Math.random() * 5)], transform: `rotate(${Math.random() * 360}deg)`}} />
        </div>
      ))}
    </div>
  );
};

const TiltCard = ({ children, className, onClick }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({x: (y - 0.5) * 10, y: (x - 0.5) * -10});
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });
  return (
    <div className={className} onClick={onClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform 0.2s ease-out'}}>
      {children}
    </div>
  );
};

const Badge = ({ badge, isNew }) => (
  <div className={`relative inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium text-white ${isNew ? 'animate-bounce' : ''}`} style={{ backgroundColor: badge.color }}>
    <span>{badge.icon}</span>
    <span>{badge.name}</span>
    {isNew && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
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
      setTimeout(() => {
        setShowConfetti(false);
        setNewAchievements([]);
      }, 5000);
    }
  }, [puzzleSolved]);

  const submitCommit = async () => {
    if (!contract || !newMessage.trim()) return;
    const oldStats = { ...userStats };
    setLoading(true);
    setTxStatus('Pending...');
    try {
      const tx = await contract.setCommit(newMessage);
      setTxStatus('Transaction sent! Confirming...');
      await tx.wait();
      setTxStatus('Confirmed! ✓');
      setShowBadge(true);
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
      setTxStatus('Error: ' + error.message.slice(0, 50));
      setTimeout(() => setTxStatus(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const clearCommit = async () => {
    if (!contract) return;
    setLoading(true);
    setTxStatus('Clearing...');
    try {
      const tx = await contract.clearCommit();
      setTxStatus('Transaction sent! Confirming...');
      await tx.wait();
      setTxStatus('Cleared! ✓');
      await fetchUserCommit();
      await fetchCommits();
      setTimeout(() => setTxStatus(''), 3000);
    } catch (error) {
      console.error('Error clearing commit:', error);
      setTxStatus('Error: ' + error.message.slice(0, 50));
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
      setTimeout(() => setShowConfetti(false), 3000);
      const currentAchievements = getAchievements(userStats.streak, userStats.totalCommits, false);
      const newAchievementsWithPuzzle = getAchievements(userStats.streak, userStats.totalCommits, true);
      const puzzleBadge = newAchievementsWithPuzzle.find(a => a.name === "Puzzle Solver");
      if (puzzleBadge && !currentAchievements.some(a => a.name === "Puzzle Solver")) {
        setNewAchievements([puzzleBadge]);
        setTimeout(() => setNewAchievements([]), 5000);
      }
    } else {
      setTxStatus('Not quite! Try again or use a hint.');
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
  const getAvatarColor = (addr) => {
    const colors = ['#0052FF', '#00D4AA', '#FF6B6B', '#A855F7', '#F59E0B'];
    const index = parseInt(addr.slice(2, 8), 16) % colors.length;
    return colors[index];
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Head>
        <title>Base Commit Agent - Builder Intent Onchain</title>
        <meta name="description" content="Autonomous onchain agent for recording builder intent on Base" />
      </Head>

      <Confetti show={showConfetti} />

      <div className="min-h-screen bg-gradient-to-br from-[#F5F7FF] via-white to-[#E8ECFF] dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500">
        
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-green-400/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        <header className="relative border-b border-[#E2E8F0] dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#0052FF] rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#0F172A] dark:text-white">Base Commit Agent</h1>
                  <p className="text-xs text-[#64748B] dark:text-gray-400">Onchain Builder Intent</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="hidden md:flex items-center space-x-1 px-3 py-2 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#003ECC] text-white text-sm font-medium hover:shadow-lg transition-all">
                  <span>🏆</span>
                  <span>Leaderboard</span>
                </button>
                <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  {darkMode ? '☀️' : '🌙'}
                </button>
                {!account ? (
                  <button onClick={connectWallet} className="px-6 py-2.5 bg-[#0052FF] hover:bg-[#003ECC] text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl">
                    Connect Wallet
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 font-medium">
                    {formatAddress(account)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {newAchievements.length > 0 && (
            <div className="fixed top-20 right-4 z-50 animate-slideIn">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 border-2 border-[#0052FF]">
                <p className="text-sm font-bold text-[#0F172A] dark:text-white mb-2">🎉 New Achievement!</p>
                {newAchievements.map((badge, i) => (
                  <Badge key={i} badge={badge} isNew={true} />
                ))}
              </div>
            </div>
          )}

          <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-2xl border border-[#E2E8F0] dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white mb-2">What is this?</h2>
            <p className="text-[#64748B] dark:text-gray-300 leading-relaxed">
              This is a <span className="font-semibold text-[#0052FF]">fully autonomous, halal, non-financial Base agent</span>. 
              Each wallet can post or clear their builder intent message. Logic is onchain, deterministic, and emits events. 
              <span className="font-semibold"> No ETH or tokens are handled, no admin functions, fully safe.</span>
            </p>
            <div className="mt-3 flex items-center space-x-4 text-sm">
              <a href={`https://basescan.org/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-[#0052FF] hover:text-[#003ECC] font-medium flex items-center space-x-1">
                <span>View Contract</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <span className="text-[#64748B] dark:text-gray-400">•</span>
              <span className="text-[#64748B] dark:text-gray-400">Base Mainnet</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 space-y-6">
              {account && (
                <>
                  <div className="p-6 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-800/50 rounded-2xl border border-[#E2E8F0] dark:border-gray-700 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">Your Commitment</h2>
                      {showBadge && (
                        <div className="animate-bounce bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                          Committed! 🎉
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-bold text-[#0F172A] dark:text-white">Your Stats</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-[#0052FF]">{userStats.streak}</p>
                            <p className="text-xs text-[#64748B] dark:text-gray-400">Day Streak 🔥</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-[#00D4AA]">{userStats.totalCommits}</p>
                            <p className="text-xs text-[#64748B] dark:text-gray-400">Total Commits</p>
                          </div>
                        </div>
                      </div>
                      {userAchievements.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {userAchievements.map((badge, i) => (
                            <Badge key={i} badge={badge} isNew={false} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <FreeAIAssistant onCommitGenerated={(commit) => setNewMessage(commit)} />
                    </div>

                    {userCommit.message && (
                      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Current: {userCommit.message}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Updated: {formatTimestamp(userCommit.timestamp)}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0F172A] dark:text-white">Or write your own:</label>
                      <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type manually or use AI suggestions above..." className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-[#E2E8F0] dark:border-gray-600 rounded-lg text-[#0F172A] dark:text-white placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#0052FF] focus:border-transparent resize-none" rows="3" disabled={loading} />
                    </div>

                    <div className="mt-4 flex items-center space-x-3">
                      <button onClick={submitCommit} disabled={loading || !newMessage.trim()} className="flex-1 px-6 py-3 bg-gradient-to-r from-[#0052FF] to-[#003ECC] hover:shadow-xl disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-600 dark:disabled:to-gray-600 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none shadow-lg">
                        {loading ? 'Processing...' : userCommit.message ? 'Update Commit' : 'Submit Commit'}
                      </button>
                      {userCommit.message && (
                        <button onClick={clearCommit} disabled={loading} className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-all duration-200 shadow-lg">
                          Clear
                        </button>
                      )}
                    </div>

                    {txStatus && (
                      <div className={`mt-3 p-3 rounded-lg text-sm ${txStatus.includes('Error') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'}`}>
                        {txStatus}
                      </div>
                    )}
                  </div><div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200 dark:border-purple-700 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-[#0F172A] dark:text-white flex items-center space-x-2">
                        <span>🧩</span>
                        <span>Daily Builder Puzzle</span>
                      </h2>
                      {puzzleSolved && (
                        <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">Solved! ✓</span>
                      )}
                    </div>
                    
                    {!puzzleSolved ? (
                      <>
                        <p className="text-[#0F172A] dark:text-white mb-4 text-sm leading-relaxed">{todaysPuzzle.question}</p>
                        
                        <input type="text" value={puzzleAnswer} onChange={(e) => setPuzzleAnswer(e.target.value)} placeholder="Your answer..." className="w-full px-4 py-2 bg-white dark:bg-gray-700 border-2 border-purple-200 dark:border-purple-600 rounded-lg text-[#0F172A] dark:text-white placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3" onKeyPress={(e) => e.key === 'Enter' && solvePuzzle()} />
                        
                        <div className="flex items-center space-x-2">
                          <button onClick={solvePuzzle} className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg transition-all">
                            Submit Answer
                          </button>
                          <button onClick={() => setShowPuzzleHint(!showPuzzleHint)} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-all">
                            💡 Hint
                          </button>
                        </div>
                        
                        {showPuzzleHint && (
                          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">💡 {todaysPuzzle.hint}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-4xl mb-2">🎉</p>
                        <p className="text-[#0F172A] dark:text-white font-bold">Puzzle Complete!</p>
                        <p className="text-sm text-[#64748B] dark:text-gray-400 mt-2">Come back tomorrow for a new challenge!</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-6">
              {showLeaderboard && leaderboard.length > 0 && (
                <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-700 shadow-xl">
                  <h2 className="text-lg font-bold text-[#0F172A] dark:text-white mb-4 flex items-center space-x-2">
                    <span>🏆</span>
                    <span>Top Builders</span>
                  </h2>
                  <div className="space-y-3">
                    {leaderboard.map((user, i) => (
                      <div key={user.address} className={`p-3 rounded-lg ${i === 0 ? 'bg-gradient-to-r from-yellow-200 to-yellow-300 dark:from-yellow-700 dark:to-yellow-800' : 'bg-white dark:bg-gray-800'} border border-yellow-300 dark:border-yellow-600`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xl">{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐'}</span>
                            <div>
                              <p className="text-sm font-bold text-[#0F172A] dark:text-white">{formatAddress(user.address)}</p>
                              <p className="text-xs text-[#64748B] dark:text-gray-400">{user.commits} commits</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-[#0052FF]">{user.streak}</p>
                            <p className="text-xs text-[#64748B] dark:text-gray-400">🔥 streak</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white">Live Commitments</h2>
              <div className="flex items-center space-x-2 text-sm text-[#64748B] dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>{commits.length} active</span>
              </div>
            </div>

            {commits.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-[#E2E8F0] dark:border-gray-700">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-[#64748B] dark:text-gray-400">No commitments yet. Be the first!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {commits.map((commit, idx) => (
                  <TiltCard key={commit.user} className="group bg-white dark:bg-gray-800 rounded-xl border border-[#E2E8F0] dark:border-gray-700 p-5 hover:shadow-2xl hover:border-[#0052FF] transition-all duration-300 cursor-pointer animate-fadeIn" style={{ animationDelay: `${idx * 50}ms` }} onClick={() => setExpandedCard(expandedCard === commit.user ? null : commit.user)}>
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg" style={{ backgroundColor: getAvatarColor(commit.user) }}>
                        {commit.user.slice(2, 4).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-[#0F172A] dark:text-white text-sm">{formatAddress(commit.user)}</span>
                          <span className="text-xs text-[#64748B] dark:text-gray-400">{new Date(commit.timestamp * 1000).toLocaleDateString()}</span>
                        </div>
                        
                        <p className={`text-[#0F172A] dark:text-gray-200 ${expandedCard === commit.user ? '' : 'line-clamp-2'} leading-relaxed`}>
                          {commit.message}
                        </p>
                        
                        {expandedCard === commit.user && (
                          <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-gray-700 space-y-2 animate-fadeIn">
                            <p className="text-xs text-[#64748B] dark:text-gray-400">
                              <span className="font-medium">Timestamp:</span> {formatTimestamp(commit.timestamp)}
                            </p>
                            <div className="flex items-center space-x-2">
                              <a href={`https://basescan.org/address/${commit.user}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 text-xs text-[#0052FF] hover:text-[#003ECC] font-medium" onClick={(e) => e.stopPropagation()}>
                                <span>View Address</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                              {commit.txHash && (
                                <>
                                  <span className="text-[#64748B]">•</span>
                                  <a href={`https://basescan.org/tx/${commit.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1 text-xs text-[#0052FF] hover:text-[#003ECC] font-medium" onClick={(e) => e.stopPropagation()}>
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
                  </TiltCard>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="relative mt-16 border-t border-[#E2E8F0] dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-sm text-[#64748B] dark:text-gray-400">
              <p>Built on Base • Fully Autonomous • Zero Financial Risk</p>
              <p className="mt-1">Powered by onchain integrity ⛓️</p>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
        .animate-confetti { animation: confetti linear forwards; }
        .animate-slideIn { animation: slideIn 0.5s ease-out; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
}
