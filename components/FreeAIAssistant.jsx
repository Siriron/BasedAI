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
          <h3 className="font-extrabold text-white text-glow">AI Commit Helper</h3>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickTemplates.map((template) => (
          <button
            key={template.category}
            onClick={() => selectQuickTemplate(template.category)}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
              selectedTemplate === template.category
                ? 'bg-gradient-to-r from-cyber-cyan to-cyber-magenta text-white shadow-lg shadow-cyber-cyan/50'
                : 'bg-cyber-card text-gray-300 hover:bg-gradient-to-r hover:from-cyber-cyan/20 hover:to-cyber-magenta/20 border border-cyber-cyan/30'
            }`}
          >
            <span className="mr-1">{template.emoji}</span>
            {template.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-cyber-cyan">
          Describe your project:
        </label>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="e.g., A lending protocol for small businesses..."
          className="w-full px-4 py-3 bg-cyber-card border-2 border-cyber-cyan/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyber-cyan focus:shadow-lg focus:shadow-cyber-cyan/30 resize-none transition-all"
          rows="2"
        />
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={generateSuggestions}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-cyber-magenta to-cyber-pink text-white font-extrabold rounded-lg hover:shadow-lg hover:shadow-cyber-magenta/50 transition-all hover:scale-105"
        >
          ✨ Get Ideas
        </button>
        {userInput.trim() && (
          <button
            onClick={improveText}
            className="px-4 py-2 bg-gradient-to-r from-cyber-cyan to-blue-500 text-white font-extrabold rounded-lg hover:shadow-lg hover:shadow-cyber-cyan/50 transition-all hover:scale-105"
          >
            ✍️ Use
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2 animate-fadeIn">
          <p className="text-sm font-bold text-cyber-lime">
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
              className="w-full text-left p-3 bg-gradient-to-r from-cyber-card to-cyber-card/50 border border-cyber-cyan/30 rounded-lg hover:border-cyber-cyan hover:shadow-lg hover:shadow-cyber-cyan/30 transition-all group"
            >
              <p className="text-sm text-white font-semibold group-hover:text-glow">
                {suggestion}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FreeAIAssistant;
