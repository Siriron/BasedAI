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
  }, [commits]);
