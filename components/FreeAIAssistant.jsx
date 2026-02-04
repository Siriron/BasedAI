import { useState } from 'react';

const FreeAIAssistant = ({ onCommitGenerated }) => {
  const [userInput, setUserInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const COMMITMENT_TEMPLATES = {
    defi: [
      "Building a decentralized lending protocol on Base for accessible finance",
      "Creating composable DeFi primitives to unlock liquidity on Base",
      "Developing yield optimization strategies for Base ecosystem growth"
    ],
    nft: [
      "Launching an NFT marketplace with zero gas minting on Base",
      "Building dynamic NFTs that evolve with onchain activity on Base",
      "Creating NFT infrastructure for digital identity on Base"
    ],
    dao: [
      "Developing DAO governance tools for decentralized decision-making on Base",
      "Building treasury management systems for Base communities",
      "Creating voting mechanisms for fair and transparent governance on Base"
    ],
    infrastructure: [
      "Building developer tools to accelerate Base ecosystem growth",
      "Creating scalable infrastructure for high-throughput dapps on Base",
      "Developing cross-chain bridges to connect Base with other networks"
    ],
    social: [
      "Building onchain social networks for authentic community engagement on Base",
      "Creating reputation systems for trusted interactions on Base",
      "Developing messaging protocols for decentralized communication on Base"
    ],
    gaming: [
      "Building onchain games with true asset ownership on Base",
      "Creating play-to-earn mechanics that reward skill and strategy on Base",
      "Developing gaming infrastructure for seamless blockchain integration on Base"
    ],
    general: [
      "Committed to building the next generation of onchain applications on Base",
      "Shipping products that make blockchain accessible to everyone on Base",
      "Creating tools that empower builders in the Base ecosystem"
    ]
  };

  const analyzeIntent = (text) => {
    const lower = text.toLowerCase();
    if (lower.match(/defi|lending|borrow|yield|liquidity|swap|dex/)) return 'defi';
    if (lower.match(/nft|token|collect|art|digital asset/)) return 'nft';
    if (lower.match(/dao|govern|vote|proposal|treasury/)) return 'dao';
    if (lower.match(/tool|infra|sdk|api|developer/)) return 'infrastructure';
    if (lower.match(/social|community|chat|message/)) return 'social';
    if (lower.match(/game|play|earn|battle/)) return 'gaming';
    return 'general';
  };

  const generateSuggestions = () => {
    if (!userInput.trim()) {
      setSuggestions([
        "Building innovative solutions on Base to empower the onchain economy",
        "Committed to shipping useful products for the Base community",
        "Creating tools that make blockchain more accessible on Base"
      ]);
      return;
    }

    const category = analyzeIntent(userInput);
    const templates = COMMITMENT_TEMPLATES[category];
    
    const personalized = templates.map(template => {
      const keywords = userInput.toLowerCase().match(/\b\w{4,}\b/g) || [];
      if (keywords.length > 0) {
        const keyword = keywords[0];
        return template.replace(/Building|Creating|Developing/, `Building ${keyword}-focused`);
      }
      return template;
    });

    setSuggestions(personalized);
    setSelectedTemplate(category);
  };

  const improveText = () => {
    if (!userInput.trim()) return;
    let improved = userInput;
    if (!improved.toLowerCase().includes('base')) {
      improved += ' on Base';
    }
    improved = improved.charAt(0).toUpperCase() + improved.slice(1);
    improved = improved.replace(/\.$/, '');
    if (!improved.match(/^(Building|Creating|Developing|Committed|Shipping)/i)) {
      improved = 'Building ' + improved.charAt(0).toLowerCase() + improved.slice(1);
    }
    onCommitGenerated(improved);
    setUserInput('');
  };

  const quickTemplates = [
    { emoji: '🏦', label: 'DeFi', category: 'defi', color: 'from-emerald-500 to-teal-500' },
    { emoji: '🎨', label: 'NFT', category: 'nft', color: 'from-pink-500 to-rose-500' },
    { emoji: '🏛️', label: 'DAO', category: 'dao', color: 'from-purple-500 to-indigo-500' },
    { emoji: '🛠️', label: 'Tools', category: 'infrastructure', color: 'from-blue-500 to-cyan-500' },
    { emoji: '💬', label: 'Social', category: 'social', color: 'from-orange-500 to-amber-500' },
    { emoji: '🎮', label: 'Gaming', category: 'gaming', color: 'from-violet-500 to-fuchsia-500' },
  ];

  const selectQuickTemplate = (category) => {
    const templates = COMMITMENT_TEMPLATES[category];
    setSuggestions(templates);
    setSelectedTemplate(category);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
            <span className="text-xl">✨</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Commit Helper</h3>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickTemplates.map((template) => (
          <button
            key={template.category}
            onClick={() => selectQuickTemplate(template.category)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              selectedTemplate === template.category
                ? `bg-gradient-to-r ${template.color} text-white shadow-lg scale-105`
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span className="mr-1.5">{template.emoji}</span>
            {template.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
          Describe your project
        </label>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="e.g., A lending protocol for small businesses..."
          className="input resize-none"
          rows="2"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={generateSuggestions}
          className="flex-1 btn-primary"
        >
          ✨ Generate Ideas
        </button>
        {userInput.trim() && (
          <button
            onClick={improveText}
            className="btn-secondary"
          >
            ✍️ Use Mine
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            💡 Click to use:
          </p>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => {
                onCommitGenerated(suggestion);
                setSuggestions([]);
                setUserInput('');
              }}
              className="w-full text-left p-4 card group hover:scale-[1.01]"
            >
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {suggestion}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Click to use</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FreeAIAssistant;
