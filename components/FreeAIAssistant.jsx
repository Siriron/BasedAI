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
    { emoji: '🏦', label: 'DeFi', category: 'defi' },
    { emoji: '🎨', label: 'NFT', category: 'nft' },
    { emoji: '🏛️', label: 'DAO', category: 'dao' },
    { emoji: '🛠️', label: 'Tools', category: 'infrastructure' },
    { emoji: '💬', label: 'Social', category: 'social' },
    { emoji: '🎮', label: 'Gaming', category: 'gaming' },
  ];

  const selectQuickTemplate = (category) => {
    const templates = COMMITMENT_TEMPLATES[category];
    setSuggestions(templates);
    setSelectedTemplate(category);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">✨</span>
          <h3 className="font-bold text-[#0F172A] dark:text-white">Smart Commit Helper</h3>
        </div>
        <span className="text-xs text-[#64748B] dark:text-gray-400 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
          100% Free
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickTemplates.map((template) => (
          <button
            key={template.category}
            onClick={() => selectQuickTemplate(template.category)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedTemplate === template.category
                ? 'bg-purple-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-[#0F172A] dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <span className="mr-1">{template.emoji}</span>
            {template.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[#0F172A] dark:text-white">
          Describe your project (optional):
        </label>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="e.g., A lending protocol for small businesses..."
          className="w-full px-4 py-3 bg-white dark:bg-gray-700 border-2 border-purple-200 dark:border-purple-600 rounded-lg text-[#0F172A] dark:text-white placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          rows="2"
        />
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={generateSuggestions}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:shadow-lg transition-all"
        >
          ✨ Get Ideas
        </button>
        {userInput.trim() && (
          <button
            onClick={improveText}
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-all"
          >
            ✍️ Use My Text
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2 animate-fadeIn">
          <p className="text-sm font-medium text-[#0F172A] dark:text-white">
            💡 Suggestions (click to use):
          </p>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => {
                onCommitGenerated(suggestion);
                setSuggestions([]);
                setUserInput('');
              }}
              className="w-full text-left p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm text-[#0F172A] dark:text-white flex-1 pr-2">
                  {suggestion}
                </p>
                <span className="text-xs text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
        <div className="flex items-start space-x-2">
          <span className="text-lg">💚</span>
          <div className="flex-1">
            <p className="text-xs text-green-900 dark:text-green-200">
              <strong>100% Free:</strong> No API keys, no costs! Uses smart templates. You sign transactions with your wallet (only Base gas fee).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreeAIAssistant;
