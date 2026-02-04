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
      case 'connect':
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        break;
      case 'success':
        oscillator.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
      case 'achievement':
        oscillator.frequency.value = 1200;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        break;
      case 'error':
        oscillator.frequency.value = 300;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
        break;
    }
  } catch(e) {
    console.log('Sound not supported');
  }
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
  if (totalCommits >= 1) badges.push({ name: "First Commit", icon: "🎯", gradient: "from-cyan-500 to-blue-500" });
  if (streak >= 3) badges.push({ name: "3-Day Streak", icon: "🔥", gradient: "from-orange-500 to-red-500" });
  if (streak >= 7) badges.push({ name: "Week Warrior", icon: "⚡", gradient: "from-yellow-500 to-orange-500" });
  if (streak >= 30) badges.push({ name: "Month Master", icon: "👑", gradient: "from-purple-500 to-pink-500" });
  if (totalCommits >= 10) badges.push({ name: "Committed Builder", icon: "🏗️", gradient: "from-green-500 to-emerald-500" });
  if (isPuzzleSolved) badges.push({ name: "Puzzle Solver", icon: "🧩", gradient: "from-violet-500 to-purple-500" });
  return badges;
};

const FloatingParticles = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {[...Array(15)].map((_, i) => (
      <div
        key={i}
        className="absolute w-1 h-1 bg-cyber-cyan rounded-full animate-float"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${10 + Math.random() * 10}s`,
          opacity: 0.4 + Math.random() * 0.3
        }}
      />
    ))}
  </div>
);

const Confetti = ({ show }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div key={i} className="absolute animate-confetti" style={{left: `${Math.random() * 100}%`, top: '-10px', animationDelay: `${Math.random() * 0.5}s`, animationDuration: `${2 + Math.random() * 2}s`}}>
          <div className="w-2 h-2 rounded-full" style={{backgroundColor: ['#00f0ff', '#ff00ff', '#00ff88', '#ffdd00', '#ff006e'][Math.floor(Math.random() * 5)], transform: `rotate(${Math.random() * 360}deg)`}} />
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
    setTilt({x: (y - 0.5) * 8, y: (x - 0.5) * -8});
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });
  return (
    <div className={className} onClick={onClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x || tilt.y ? 1.05 : 1})`, transition: 'all 0.3s ease-out'}}>
      {children}
    </div>
  );
};

const Badge = ({ badge, isNew }) => (
  <div className={`relative inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-extrabold text-white bg-gradient-to-r ${badge.gradient} ${isNew ? 'animate-bounce' : ''} shadow-lg hover:shadow-2xl transition-all hover:scale-105`}>
    <span className="text-lg">{badge.icon}</span>
    <span>{badge.name}</span>
    {isNew && <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyber-yellow rounded-full animate-ping" />}
  </div>
);

const TypingText = ({ text }) => {
  const [displayText, setDisplayText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  
  useEffect(() => {
    let index = 0;
    const typingInterval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(typingInterval);
      }
    }, 100);
    
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    
    return () => {
      clearInterval(typingInterval);
      clearInterval(cursorInterval);
    };
  }, [text]);
  
  return <span>{displayText}{showCursor && <span className="text-cyber-cyan">|</span>}</span>;
};export default function Home() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [commits, setCommits] = useState([]);
  const [userCommit, setUserCommit] = useState({ message: '', timestamp: 0 });
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
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
  }, [commits]);

  const connectWallet = async () => {
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
    setTxStatus('⏳ Pending...');
    try {
      const tx = await contract.setCommit(newMessage);
      setTxStatus('🚀 Transaction sent! Confirming...');
      await tx.wait();
      setTxStatus('✅ Confirmed!');
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
    setTxStatus('🗑️ Clearing...');
    try {
      const tx = await contract.clearCommit();
      setTxStatus('🚀 Transaction sent! Confirming...');
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
      setTxStatus('❌ Not quite! Try again or use a hint.');
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
  const getAvatarColor = (addr) => {
    const colors = ['#00f0ff', '#ff00ff', '#00ff88', '#ffdd00', '#ff006e'];
    const index = parseInt(addr.slice(2, 8), 16) % colors.length;
    return colors[index];
  };

  return (
    <div className="dark">
      <Head>
        <title>Base Agent - Onchain Builder Intent</title>
        <meta name="description" content="AI-powered onchain commitment agent on Base" />
      </Head>

      <Confetti show={showConfetti} />
      <FloatingParticles />

      <div className="min-h-screen bg-cyber-dark text-white relative overflow-hidden">
        
        <div className="fixed inset-0 bg-gradient-to-br from-cyber-dark via-purple-900/10 to-cyber-dark pointer-events-none"></div>

        <header className="relative border-b border-cyber-cyan/20 bg-cyber-card/50 backdrop-blur-md z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyber-cyan to-cyber-magenta rounded-lg flex items-center justify-center shadow-lg shadow-cyber-cyan/50 animate-pulse-glow">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-glow">
                    <TypingText text="BASE AGENT" />
                  </h1>
                  <p className="text-xs sm:text-sm text-cyber-cyan font-bold">Onchain Builder Intent</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button 
                  onClick={() => setShowLeaderboard(!showLeaderboard)} 
                  className="hidden md:flex items-center space-x-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyber-yellow to-cyber-lime text-black text-sm font-extrabold hover:shadow-lg hover:shadow-cyber-yellow/50 transition-all hover:scale-105"
                >
                  <span>🏆</span>
                  <span>TOP 5</span>
                </button>
                <button 
                  onClick={() => setSoundEnabled(!soundEnabled)} 
                  className="p-2 rounded-lg bg-cyber-card border border-cyber-cyan/30 hover:border-cyber-cyan hover:shadow-lg hover:shadow-cyber-cyan/30 transition-all"
                  title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                >
                  {soundEnabled ? '🔊' : '🔇'}
                </button>
                {!account ? (
                  <button 
                    onClick={connectWallet} 
                    className="px-4 sm:px-6 py-2.5 bg-gradient-to-r from-cyber-cyan to-blue-500 text-white font-extrabold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg shadow-cyber-cyan/50 hover:shadow-cyber-cyan/80"
                  >
                    CONNECT WALLET
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-gradient-to-r from-cyber-lime/20 to-cyber-cyan/20 border border-cyber-lime rounded-lg text-cyber-lime font-extrabold text-sm">
                    {formatAddress(account)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 z-10">
          
          {newAchievements.length > 0 && (
            <div className="fixed top-20 right-4 z-50 animate-slideIn">
              <div className="bg-cyber-card rounded-xl shadow-2xl p-4 border-2 border-cyber-cyan shadow-cyber-cyan/50">
                <p className="text-sm font-extrabold text-cyber-cyan mb-2">🎉 NEW ACHIEVEMENT!</p>
                <div className="space-y-2">
                  {newAchievements.map((badge, i) => (
                    <Badge key={i} badge={badge} isNew={true} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {account && (
                <>
                  <div className="p-4 sm:p-6 bg-glass rounded-2xl border-2 border-cyber-cyan/30 shadow-2xl shadow-cyber-cyan/20 animate-glow">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                      <h2 className="text-xl sm:text-2xl font-black text-glow">YOUR COMMITMENT</h2>
                      {showBadge && (
                        <div className="animate-bounce bg-gradient-to-r from-cyber-lime to-cyber-cyan text-black px-4 py-2 rounded-full text-sm font-extrabold shadow-lg">
                          COMMITTED! 🎉
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-4 p-4 bg-gradient-to-r from-cyber-cyan/10 to-cyber-magenta/10 rounded-xl border border-cyber-cyan/30">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="text-center p-3 bg-cyber-card/50 rounded-lg">
                          <p className="text-4xl sm:text-6xl font-black text-cyber-cyan text-glow">{userStats.streak}</p>
                          <p className="text-xs sm:text-sm text-gray-400 font-bold mt-1">DAY STREAK 🔥</p>
                        </div>
                        <div className="text-center p-3 bg-cyber-card/50 rounded-lg">
                          <p className="text-4xl sm:text-6xl font-black text-cyber-lime text-glow">{userStats.totalCommits}</p>
                          <p className="text-xs sm:text-sm text-gray-400 font-bold mt-1">TOTAL COMMITS</p>
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
                      <div className="mb-4 p-4 bg-cyber-cyan/10 border border-cyber-cyan/50 rounded-lg">
                        <p className="text-sm font-bold text-cyber-cyan mb-1">CURRENT:</p>
                        <p className="text-white font-semibold">{userCommit.message}</p>
                        <p className="text-xs text-gray-400 mt-2">Updated: {formatTimestamp(userCommit.timestamp)}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-cyber-magenta">OR WRITE YOUR OWN:</label>
                      <textarea 
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        placeholder="Type your commitment here..." 
                        className="w-full px-4 py-3 bg-cyber-card border-2 border-cyber-magenta/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyber-magenta focus:shadow-lg focus:shadow-cyber-magenta/30 resize-none font-semibold transition-all" 
                        rows="3" 
                        disabled={loading} 
                      />
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                      <button 
                        onClick={submitCommit} 
                        disabled={loading || !newMessage.trim()} 
                        className="w-full sm:flex-1 px-6 py-3 bg-gradient-to-r from-cyber-cyan to-cyber-magenta hover:shadow-xl disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-extrabold rounded-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-lg shadow-cyber-cyan/50 text-lg"
                      >
                        {loading ? '⏳ PROCESSING...' : userCommit.message ? '🔄 UPDATE' : '✅ SUBMIT'}
                      </button>
                      {userCommit.message && (
                        <button 
                          onClick={clearCommit} 
                          disabled={loading} 
                          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyber-pink to-red-500 hover:shadow-xl disabled:from-gray-600 disabled:to-gray-600 text-white font-extrabold rounded-lg transition-all duration-200 shadow-lg shadow-cyber-pink/50"
                        >
                          🗑️ CLEAR
                        </button>
                      )}
                    </div>

                    {txStatus && (
                      <div className={`mt-3 p-3 rounded-lg text-sm font-bold ${txStatus.includes('Error') || txStatus.includes('❌') ? 'bg-cyber-pink/20 text-cyber-pink border border-cyber-pink/50' : 'bg-cyber-lime/20 text-cyber-lime border border-cyber-lime/50'}`}>
                        {txStatus}
                      </div>
                    )}
                  </div><div className="p-4 sm:p-6 bg-glass rounded-2xl border-2 border-cyber-magenta/30 shadow-2xl shadow-cyber-magenta/20 animate-glow">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl sm:text-2xl font-black text-cyber-magenta text-glow flex items-center space-x-2">
                        <span>🧩</span>
                        <span>DAILY PUZZLE</span>
                      </h2>
                      {puzzleSolved && (
                        <span className="px-3 py-1 bg-gradient-to-r from-cyber-lime to-cyber-cyan text-black text-xs font-extrabold rounded-full">
                          SOLVED! ✓
                        </span>
                      )}
                    </div>
                    
                    {!puzzleSolved ? (
                      <>
                        <p className="text-white mb-4 text-sm sm:text-base leading-relaxed font-semibold">{todaysPuzzle.question}</p>
                        
                        <input 
                          type="text" 
                          value={puzzleAnswer} 
                          onChange={(e) => setPuzzleAnswer(e.target.value)} 
                          placeholder="Your answer..." 
                          className="w-full px-4 py-3 bg-cyber-card border-2 border-cyber-magenta/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyber-magenta focus:shadow-lg focus:shadow-cyber-magenta/50 mb-3 font-semibold" 
                          onKeyPress={(e) => e.key === 'Enter' && solvePuzzle()} 
                        />
                        
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <button 
                            onClick={solvePuzzle} 
                            className="w-full sm:flex-1 px-4 py-3 bg-gradient-to-r from-cyber-magenta to-cyber-pink text-white font-extrabold rounded-lg hover:shadow-lg hover:shadow-cyber-magenta/50 transition-all hover:scale-105"
                          >
                            ✅ SUBMIT ANSWER
                          </button>
                          <button 
                            onClick={() => setShowPuzzleHint(!showPuzzleHint)} 
                            className="w-full sm:w-auto px-4 py-3 bg-gradient-to-r from-cyber-yellow to-cyber-lime text-black font-extrabold rounded-lg hover:shadow-lg hover:shadow-cyber-yellow/50 transition-all hover:scale-105"
                          >
                            💡 HINT
                          </button>
                        </div>
                        
                        {showPuzzleHint && (
                          <div className="mt-3 p-3 bg-cyber-yellow/20 border border-cyber-yellow/50 rounded-lg animate-fadeIn">
                            <p className="text-sm text-cyber-yellow font-bold">💡 {todaysPuzzle.hint}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-6xl mb-3 animate-bounce">🎉</p>
                        <p className="text-2xl font-black text-cyber-lime text-glow mb-2">PUZZLE COMPLETE!</p>
                        <p className="text-sm text-gray-400 font-semibold">Come back tomorrow for a new challenge!</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4 sm:space-y-6">
              {showLeaderboard && leaderboard.length > 0 && (
                <div className="p-4 sm:p-6 bg-glass rounded-2xl border-2 border-cyber-yellow/30 shadow-2xl shadow-cyber-yellow/20 animate-glow">
                  <h2 className="text-xl sm:text-2xl font-black text-cyber-yellow text-glow mb-4 flex items-center space-x-2">
                    <span>🏆</span>
                    <span>TOP BUILDERS</span>
                  </h2>
                  <div className="space-y-3">
                    {leaderboard.map((user, i) => (
                      <div 
                        key={user.address} 
                        className={`p-3 rounded-lg transition-all hover:scale-105 ${
                          i === 0 
                            ? 'bg-gradient-to-r from-cyber-yellow/30 to-cyber-lime/30 border-2 border-cyber-yellow shadow-lg shadow-cyber-yellow/50' 
                            : 'bg-cyber-card border border-cyber-cyan/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-2xl">{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⭐'}</span>
                            <div>
                              <p className="text-sm font-extrabold text-white">{formatAddress(user.address)}</p>
                              <p className="text-xs text-gray-400 font-semibold">{user.commits} commits</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-cyber-cyan text-glow">{user.streak}</p>
                            <p className="text-xs text-gray-400 font-semibold">🔥 streak</p>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-2xl sm:text-3xl font-black text-glow">LIVE FEED</h2>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-cyber-lime rounded-full animate-pulse shadow-lg shadow-cyber-lime/50"></div>
                <span className="text-cyber-lime font-bold">{commits.length} ACTIVE</span>
              </div>
            </div>

            {commits.length === 0 ? (
              <div className="text-center py-16 bg-glass rounded-2xl border-2 border-cyber-cyan/30">
                <div className="text-6xl mb-4 animate-pulse">📝</div>
                <p className="text-gray-400 font-bold text-lg">No commitments yet</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {commits.map((commit, idx) => (
                  <TiltCard 
                    key={commit.user} 
                    className="group bg-glass rounded-xl border-2 border-cyber-cyan/30 p-4 sm:p-5 hover:border-cyber-cyan hover:shadow-2xl hover:shadow-cyber-cyan/50 transition-all duration-300 cursor-pointer animate-fadeIn" 
                    style={{ animationDelay: `${idx * 50}ms` }} 
                    onClick={() => setExpandedCard(expandedCard === commit.user ? null : commit.user)}
                  >
                    <div className="flex items-start space-x-3">
                      <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-black flex-shrink-0 shadow-lg text-sm sm:text-base" 
                        style={{ 
                          backgroundColor: getAvatarColor(commit.user),
                          boxShadow: `0 0 20px ${getAvatarColor(commit.user)}80`
                        }}
                      >
                        {commit.user.slice(2, 4).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-white text-sm">{formatAddress(commit.user)}</span>
                          <span className="text-xs text-gray-400 font-semibold">{new Date(commit.timestamp * 1000).toLocaleDateString()}</span>
                        </div>
                        
                        <p className={`text-gray-200 font-semibold ${expandedCard === commit.user ? '' : 'line-clamp-2'} leading-relaxed text-sm sm:text-base`}>
                          {commit.message}
                        </p>
                        
                        {expandedCard === commit.user && (
                          <div className="mt-3 pt-3 border-t border-cyber-cyan/30 space-y-2 animate-fadeIn">
                            <p className="text-xs text-gray-400 font-semibold">
                              <span className="text-cyber-cyan font-bold">TIMESTAMP:</span> {formatTimestamp(commit.timestamp)}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <a 
                                href={`https://basescan.org/address/${commit.user}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center space-x-1 text-cyber-cyan hover:text-cyber-magenta font-bold transition-colors" 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>VIEW ADDRESS</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                              {commit.txHash && (
                                <>
                                  <span className="text-gray-600">•</span>
                                  <a 
                                    href={`https://basescan.org/tx/${commit.txHash}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center space-x-1 text-cyber-cyan hover:text-cyber-magenta font-bold transition-colors" 
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <span>VIEW TX</span>
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
        </main></div>

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
        .line-clamp-2 { 
          display: -webkit-box; 
          -webkit-line-clamp: 2; 
          -webkit-box-orient: vertical; 
          overflow: hidden; 
        }
      `}</style>
    </div>
  );
}
