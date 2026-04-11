import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";

// ═══════════════════════════════════════════════════════════════
// DATABASE LAYER — Works in regular browsers
// Uses in-memory storage with React state synchronization
// ═══════════════════════════════════════════════════════════════

const memoryStore = {};

const DB = {
  get(key) {
    try {
      const val = memoryStore[key];
      return val !== undefined ? JSON.parse(JSON.stringify(val)) : null;
    } catch { return null; }
  },
  set(key, value) {
    try {
      memoryStore[key] = JSON.parse(JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  delete(key) {
    delete memoryStore[key];
    return true;
  },
};

// Database initialization — runs synchronously at import time
const initDB = () => {
  if (DB.get("db:initialized")) return;

  // Seed categories
  DB.set("categories", [
    { id: "tech", name: "Technology", icon: "💻", color: "#0ea5e9" },
    { id: "lifestyle", name: "Lifestyle", icon: "🌿", color: "#10b981" },
    { id: "business", name: "Business", icon: "📊", color: "#8b5cf6" },
    { id: "culture", name: "Culture", icon: "🎭", color: "#f59e0b" },
    { id: "science", name: "Science", icon: "🔬", color: "#ef4444" },
    { id: "travel", name: "Travel", icon: "✈️", color: "#06b6d4" },
    { id: "food", name: "Food & Recipes", icon: "🍳", color: "#ec4899" },
    { id: "opinion", name: "Opinion", icon: "💬", color: "#6366f1" },
  ]);

  // Seed sample articles
  const sampleArticles = [
    {
      id: "post-1", title: "The Future of Artificial Intelligence in 2026",
      slug: "future-of-ai-2026",
      excerpt: "Exploring how AI is reshaping industries, from healthcare to creative arts, and what we can expect in the coming years.",
      content: `Artificial intelligence has moved far beyond simple chatbots and recommendation engines. In 2026, we're witnessing a paradigm shift that touches every corner of human endeavor.\n\n## The Healthcare Revolution\n\nAI-powered diagnostic tools are now achieving accuracy rates that surpass experienced physicians in certain specialties. From detecting early-stage cancers in medical imaging to predicting patient deterioration hours before it occurs, these systems are saving lives daily.\n\n## Creative Industries\n\nThe creative landscape has been transformed. AI doesn't replace human creativity — it amplifies it. Musicians use AI to explore new sonic territories, architects leverage generative design to create structures that were previously impossible to conceive, and writers collaborate with AI to push narrative boundaries.\n\n## The Ethical Dimension\n\nWith great power comes great responsibility. The AI community is grappling with questions of bias, transparency, and accountability. How do we ensure these powerful tools serve all of humanity equally?\n\n## Looking Ahead\n\nThe trajectory is clear: AI will continue to evolve, becoming more capable, more nuanced, and more integrated into our daily lives. The question isn't whether AI will change the world — it already has. The question is how we'll shape that change.`,
      category: "tech", tags: ["AI", "Technology", "Future", "Innovation"],
      author: "admin", authorName: "Editorial Team",
      coverImage: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop",
      status: "published", featured: true,
      readTime: 6, views: 2847, likes: 194,
      createdAt: "2026-04-08T10:00:00Z", publishedAt: "2026-04-08T10:00:00Z"
    },
    {
      id: "post-2", title: "10 Hidden Gems for Solo Travelers in Southeast Asia",
      slug: "hidden-gems-southeast-asia",
      excerpt: "Beyond the tourist trails: discover untouched beaches, secret temples, and authentic local experiences.",
      content: `Southeast Asia has long been a favorite destination for backpackers and luxury travelers alike. But beyond the well-trodden paths of Bangkok, Bali, and Angkor Wat lie hidden treasures waiting to be discovered.\n\n## 1. Koh Rong Samloem, Cambodia\n\nWhile Koh Rong attracts the party crowd, its smaller sibling Koh Rong Samloem offers pristine beaches with bioluminescent plankton that light up the shoreline at night.\n\n## 2. Phong Nha, Vietnam\n\nHome to the world's largest cave, Son Doong, this region offers spelunking adventures through vast underground river systems and cathedral-like caverns.\n\n## 3. Kampot, Cambodia\n\nA sleepy riverside town famous for its pepper plantations, French colonial architecture, and the nearby Bokor Hill Station with its abandoned casino shrouded in mist.\n\n## Travel Tips\n\n- Learn basic phrases in local languages\n- Travel during shoulder seasons for fewer crowds\n- Support local businesses over international chains\n- Always carry a reusable water bottle\n\nThe best adventures often begin where the guidebook ends.`,
      category: "travel", tags: ["Travel", "Southeast Asia", "Solo Travel", "Adventure"],
      author: "admin", authorName: "Editorial Team",
      coverImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop",
      status: "published", featured: true,
      readTime: 8, views: 1923, likes: 156,
      createdAt: "2026-04-07T14:00:00Z", publishedAt: "2026-04-07T14:00:00Z"
    },
    {
      id: "post-3", title: "The Psychology of Productivity: Why Less is More",
      slug: "psychology-of-productivity",
      excerpt: "Research reveals that working smarter, not harder, is the key to sustainable high performance.",
      content: `In a culture that glorifies hustle, new research is challenging everything we thought we knew about productivity.\n\n## The Myth of the 80-Hour Week\n\nStudies from Stanford University show that productivity per hour drops sharply after 50 hours of work per week. Beyond 55 hours, the additional output is negligible.\n\n## Deep Work vs. Shallow Work\n\nCal Newport's concept of deep work has been validated by neuroscience. Our brains are designed for focused, uninterrupted concentration — not the constant context-switching demanded by modern work environments.\n\n## The Power of Rest\n\nRest isn't the opposite of work — it's work's partner. Elite performers across fields share a common trait: they take rest as seriously as they take effort.\n\n## Practical Strategies\n\n- Time-block your calendar for deep work sessions\n- Practice the two-minute rule for quick tasks\n- Build recovery periods into your day\n- Say no to meetings that could be emails\n- Use the Pomodoro technique for sustained focus\n\nProductivity isn't about doing more. It's about doing what matters.`,
      category: "lifestyle", tags: ["Productivity", "Psychology", "Work-Life Balance"],
      author: "admin", authorName: "Editorial Team",
      coverImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=400&fit=crop",
      status: "published", featured: false,
      readTime: 5, views: 3412, likes: 287,
      createdAt: "2026-04-06T09:00:00Z", publishedAt: "2026-04-06T09:00:00Z"
    },
    {
      id: "post-4", title: "Building a Sustainable Business in the Age of Climate Change",
      slug: "sustainable-business-climate",
      excerpt: "How forward-thinking companies are turning environmental responsibility into competitive advantage.",
      content: `Climate change isn't just an environmental issue — it's a business imperative. Companies that adapt now will thrive; those that don't will be left behind.\n\n## The Business Case for Sustainability\n\nConsumers are voting with their wallets. Over 73% of millennials and Gen Z are willing to pay more for sustainable products. This shift is creating enormous opportunities.\n\n## Circular Economy Models\n\nThe linear take-make-dispose model is dying. Forward-thinking companies are designing products for longevity, repairability, and recyclability — and finding that circular models can be more profitable.\n\n## Supply Chain Transparency\n\nBlockchain technology is enabling unprecedented supply chain visibility, allowing companies to verify ethical sourcing and carbon footprint claims.\n\nThe companies that will define the next century are those building sustainability into their DNA today.`,
      category: "business", tags: ["Business", "Sustainability", "Climate", "Innovation"],
      author: "admin", authorName: "Editorial Team",
      coverImage: "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&h=400&fit=crop",
      status: "published", featured: false,
      readTime: 7, views: 1567, likes: 98,
      createdAt: "2026-04-05T11:00:00Z", publishedAt: "2026-04-05T11:00:00Z"
    },
    {
      id: "post-5", title: "The Renaissance of Fermentation: Ancient Techniques, Modern Kitchen",
      slug: "renaissance-of-fermentation",
      excerpt: "From kimchi to kombucha, discover why fermented foods are the cornerstone of gut health and culinary creativity.",
      content: `Fermentation is humanity's oldest biotechnology, predating agriculture itself. Today, it's experiencing a renaissance driven by science and culinary curiosity.\n\n## Why Fermentation Matters\n\nFermented foods are teeming with beneficial bacteria that support gut health, boost immunity, and even influence mood through the gut-brain axis.\n\n## Getting Started\n\nYou don't need fancy equipment. A mason jar, some salt, and fresh vegetables are enough to begin your fermentation journey.\n\n### Simple Sauerkraut\n\nShred a head of cabbage, toss with 2% salt by weight, pack into a jar, and wait. In 5-7 days, you'll have tangy, probiotic-rich sauerkraut.\n\n### Water Kefir\n\nA refreshing, fizzy probiotic drink that takes just 24-48 hours to brew. Add fruit juice for natural flavoring.\n\nThe kitchen is your laboratory. Start small, experiment boldly, and trust the microbes.`,
      category: "food", tags: ["Food", "Fermentation", "Health", "Recipes"],
      author: "admin", authorName: "Editorial Team",
      coverImage: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=400&fit=crop",
      status: "published", featured: false,
      readTime: 6, views: 2134, likes: 175,
      createdAt: "2026-04-04T16:00:00Z", publishedAt: "2026-04-04T16:00:00Z"
    },
    {
      id: "post-6", title: "Quantum Computing Explained: A Beginner's Guide",
      slug: "quantum-computing-beginners-guide",
      excerpt: "Demystifying qubits, superposition, and entanglement — and why quantum computing matters for everyone.",
      content: `Quantum computing sounds like science fiction, but it's rapidly becoming science fact. Here's what you need to know.\n\n## Classical vs. Quantum\n\nClassical computers use bits — 0s and 1s. Quantum computers use qubits, which can exist in multiple states simultaneously through a property called superposition.\n\n## Entanglement\n\nWhen qubits become entangled, the state of one instantly influences the state of another, regardless of distance. Einstein called this "spooky action at a distance."\n\n## Real-World Applications\n\n- **Drug Discovery**: Simulating molecular interactions to develop new medicines\n- **Cryptography**: Breaking current encryption methods while creating unbreakable new ones\n- **Climate Modeling**: Running vastly more accurate simulations of Earth's climate\n- **Financial Modeling**: Optimizing portfolios and detecting fraud patterns\n\nQuantum computing won't replace classical computing — it will complement it, tackling problems that are currently impossible to solve.`,
      category: "science", tags: ["Quantum Computing", "Science", "Technology", "Education"],
      author: "admin", authorName: "Editorial Team",
      coverImage: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=400&fit=crop",
      status: "published", featured: true,
      readTime: 7, views: 4521, likes: 312,
      createdAt: "2026-04-03T08:00:00Z", publishedAt: "2026-04-03T08:00:00Z"
    },
  ];

  for (const article of sampleArticles) {
    DB.set(`post:${article.id}`, article);
  }
  DB.set("posts:index", sampleArticles.map(a => a.id));
  DB.set("users:index", ["admin"]);
  DB.set("user:admin", {
    id: "admin", username: "admin", displayName: "Editorial Team",
    email: "admin@thepulse.com", password: "admin123",
    role: "admin", avatar: null, bio: "The editorial team behind The Pulse.",
    joinedAt: "2026-01-01T00:00:00Z",
  });
  DB.set("comments:index", []);
  DB.set("subscribers:index", []);
  DB.set("db:initialized", true);
};

// Initialize immediately
initDB();

// ═══════════════════════════════════════════════
// CONTEXT & STATE
// ═══════════════════════════════════════════════

const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

// ═══════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════

const Icon = ({ name, size = 20, className = "", style: extraStyle = {} }) => {
  const icons = {
    home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/>,
    search: <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>,
    user: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>,
    heart: <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>,
    heartFill: <path fill="currentColor" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>,
    comment: <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>,
    bookmark: <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>,
    bookmarkFill: <path fill="currentColor" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>,
    share: <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>,
    clock: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>,
    eye: <><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>,
    edit: <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>,
    trash: <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>,
    plus: <path d="M12 4v16m8-8H4"/>,
    close: <path d="M6 18L18 6M6 6l12 12"/>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    chevronRight: <path d="M9 5l7 7-7 7"/>,
    chevronDown: <path d="M19 9l-7 7-7-7"/>,
    mail: <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>,
    settings: <><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></>,
    dashboard: <path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm10-2a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z"/>,
    image: <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>,
    tag: <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>,
    trending: <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>,
    bell: <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>,
    logout: <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>,
    sun: <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>,
    moon: <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>,
    fire: <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>,
    globe: <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>,
    check: <path d="M5 13l4 4L19 7"/>,
    arrowUp: <path d="M5 10l7-7m0 0l7 7m-7-7v18"/>,
    camera: <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>,
    lock: <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={{ flexShrink: 0, ...extraStyle }}>
      {icons[name]}
    </svg>
  );
};

// ═══════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const estimateReadTime = (text) => Math.max(1, Math.ceil((text?.split(/\s+/).length || 0) / 200));

const renderMarkdown = (text) => {
  if (!text) return "";
  return text
    .replace(/^### (.*$)/gm, '<h3 style="font-family:\'Playfair Display\',serif;font-size:1.25rem;font-weight:700;margin:1.5em 0 .5em;color:var(--text-primary)">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="font-family:\'Playfair Display\',serif;font-size:1.5rem;font-weight:700;margin:2em 0 .75em;color:var(--text-primary)">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="font-family:\'Playfair Display\',serif;font-size:1.875rem;font-weight:700;margin:2em 0 .75em;color:var(--text-primary)">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:var(--text-primary)">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li style="margin:.25em 0;margin-left:1.5em;list-style:disc">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin:1em 0;line-height:1.8">')
    .replace(/\n/g, '<br/>');
};

// ═══════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
    :root {
      --bg-primary: #faf9f7; --bg-secondary: #f0eee9; --bg-card: #ffffff; --bg-elevated: #ffffff;
      --text-primary: #1a1a1a; --text-secondary: #5a5a5a; --text-tertiary: #8a8a8a;
      --accent: #c45d3e; --accent-hover: #a84d32; --accent-light: rgba(196,93,62,0.08);
      --accent-secondary: #2d6a4f; --border: #e5e2dc; --border-light: #f0eee9;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.04); --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
      --shadow-lg: 0 8px 30px rgba(0,0,0,0.08); --shadow-xl: 0 20px 60px rgba(0,0,0,0.1);
      --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-xl: 24px;
      --font-display: 'Playfair Display', Georgia, serif;
      --font-body: 'Source Sans 3', 'Segoe UI', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
      --max-width: 1280px; --header-height: 72px; --transition: 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    [data-theme="dark"] {
      --bg-primary: #111110; --bg-secondary: #1a1918; --bg-card: #1e1d1c; --bg-elevated: #252423;
      --text-primary: #ede9e3; --text-secondary: #a8a29e; --text-tertiary: #78716c;
      --accent: #e07a5f; --accent-hover: #e8927a; --accent-light: rgba(224,122,95,0.1);
      --border: #2e2c2a; --border-light: #252423;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.2); --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
      --shadow-lg: 0 8px 30px rgba(0,0,0,0.4); --shadow-xl: 0 20px 60px rgba(0,0,0,0.5);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { font-family: var(--font-body); background: var(--bg-primary); color: var(--text-primary); -webkit-font-smoothing: antialiased; line-height: 1.6; }
    ::selection { background: var(--accent); color: white; }
    input, textarea, select, button { font-family: inherit; font-size: inherit; }
    a { color: inherit; text-decoration: none; }
    .container { max-width: var(--max-width); margin: 0 auto; padding: 0 24px; }
    @media (max-width: 768px) { .container { padding: 0 16px; } :root { --header-height: 60px; } }
    ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: var(--bg-secondary); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
    @keyframes fadeInUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
    @keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
    @keyframes slideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
    @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
    @keyframes shimmer { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
    .animate-in { animation: fadeIn .4s ease-out forwards; }
    .animate-up { animation: fadeInUp .5s ease-out forwards; }
    .toast-container { position:fixed; bottom:24px; right:24px; z-index:9999; display:flex; flex-direction:column; gap:8px; }
    .toast { padding:14px 20px; border-radius:var(--radius-md); background:var(--bg-elevated); border:1px solid var(--border); box-shadow:var(--shadow-lg); animation:slideDown .3s ease-out; font-size:14px; font-weight:500; color:var(--text-primary); display:flex; align-items:center; gap:10px; }
    .toast.success { border-left:4px solid var(--accent-secondary); }
    .toast.error { border-left:4px solid #ef4444; }
    .toast.info { border-left:4px solid var(--accent); }
    .article-body p { margin:1em 0; line-height:1.85; font-size:1.125rem; color:var(--text-secondary); }
    .article-body h2,.article-body h3 { color:var(--text-primary); }
    .article-body li { color:var(--text-secondary); font-size:1.125rem; line-height:1.85; }
    .article-body strong { color:var(--text-primary); }
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; animation:fadeIn .2s ease-out; padding:16px; }
    .skeleton { background:linear-gradient(90deg,var(--bg-secondary) 25%,var(--border-light) 50%,var(--bg-secondary) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:var(--radius-sm); }
    .back-to-top { position:fixed; bottom:32px; right:32px; z-index:100; width:44px; height:44px; border-radius:50%; background:var(--accent); color:white; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:var(--shadow-lg); transition:var(--transition); opacity:0; pointer-events:none; transform:translateY(8px); }
    .back-to-top.visible { opacity:1; pointer-events:auto; transform:translateY(0); }
    .back-to-top:hover { transform:translateY(-2px); box-shadow:var(--shadow-xl); }
    @media (max-width:900px) { .hide-mobile { display:none !important; } .main-grid { grid-template-columns:1fr !important; } .featured-grid { grid-template-columns:1fr !important; } }
  `}</style>
);

// ═══════════════════════════════════════════════
// AVATAR COMPONENT (supports profile pictures)
// ═══════════════════════════════════════════════

const Avatar = ({ src, name, size = 36, fontSize = 14 }) => {
  if (src) {
    return <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
      <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>;
  }
  return <div style={{
    width: size, height: size, borderRadius: "50%", background: "var(--accent)", color: "white",
    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize, flexShrink: 0,
  }}>{name?.[0]?.toUpperCase() || "U"}</div>;
};

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════

const ToastContainer = ({ toasts }) => (
  <div className="toast-container">
    {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"} {t.message}</div>)}
  </div>
);

// ═══════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════

const Header = () => {
  const { currentUser, setPage, page, theme, toggleTheme, logout, categories } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSearch = (e) => { e.preventDefault(); if (searchQuery.trim()) { setPage({ name: "search", query: searchQuery.trim() }); setSearchOpen(false); setSearchQuery(""); } };

  const ddBtn = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", border: "none", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "var(--text-primary)", textAlign: "left", transition: "var(--transition)" };

  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 100, height: "var(--header-height)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(20px)", backgroundColor: "color-mix(in srgb, var(--bg-primary) 85%, transparent)" }}>
        <div className="container" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setPage({ name: "home" })}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>P</div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em" }}>The Pulse</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {["Home", "Categories", "Trending", "About"].map(item => (
              <button key={item} onClick={() => setPage({ name: item.toLowerCase() })} className="hide-mobile"
                style={{ padding: "8px 14px", border: "none", borderRadius: "var(--radius-sm)", background: page.name === item.toLowerCase() ? "var(--accent-light)" : "transparent", color: page.name === item.toLowerCase() ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "var(--transition)" }}>
                {item}
              </button>
            ))}
            <div className="hide-mobile" style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />
            <button onClick={() => setSearchOpen(true)} style={{ padding: 8, border: "none", background: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}><Icon name="search" size={20} /></button>
            <button onClick={toggleTheme} style={{ padding: 8, border: "none", background: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}><Icon name={theme === "dark" ? "sun" : "moon"} size={20} /></button>
            {currentUser ? (
              <div style={{ position: "relative" }}>
                <button onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", cursor: "pointer" }}>
                  <Avatar src={currentUser.avatar} name={currentUser.displayName} size={28} fontSize={12} />
                  <span className="hide-mobile" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{currentUser.displayName}</span>
                  <Icon name="chevronDown" size={14} />
                </button>
                {userMenuOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setUserMenuOpen(false)} />
                    <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", minWidth: 200, padding: 4, zIndex: 51, animation: "slideDown .2s ease-out" }}>
                      {currentUser.role === "admin" && <button onClick={() => { setPage({ name: "admin" }); setUserMenuOpen(false); }} style={ddBtn}><Icon name="dashboard" size={16} /> Dashboard</button>}
                      <button onClick={() => { setPage({ name: "write" }); setUserMenuOpen(false); }} style={ddBtn}><Icon name="edit" size={16} /> Write Post</button>
                      <button onClick={() => { setPage({ name: "profile" }); setUserMenuOpen(false); }} style={ddBtn}><Icon name="user" size={16} /> My Profile</button>
                      <button onClick={() => { setPage({ name: "bookmarks" }); setUserMenuOpen(false); }} style={ddBtn}><Icon name="bookmark" size={16} /> Bookmarks</button>
                      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                      <button onClick={() => { logout(); setUserMenuOpen(false); }} style={{ ...ddBtn, color: "#ef4444" }}><Icon name="logout" size={16} /> Sign Out</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => setPage({ name: "login" })} style={{ padding: "8px 20px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Sign In</button>
            )}
            <button onClick={() => setMenuOpen(true)} className="mobile-menu-btn" style={{ padding: 8, border: "none", background: "none", color: "var(--text-secondary)", cursor: "pointer", display: "none" }}><Icon name="menu" size={24} /></button>
            <style>{`@media (max-width:600px) { .mobile-menu-btn { display:flex !important; } }`}</style>
          </nav>
        </div>
      </header>

      {searchOpen && (
        <div className="modal-overlay" onClick={() => setSearchOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: "100%", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xl)" }}>
            <form onSubmit={handleSearch} style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)", gap: 12 }}>
              <Icon name="search" size={22} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search articles, topics, authors..." autoFocus style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: 17, color: "var(--text-primary)" }} />
              <kbd style={{ padding: "2px 8px", borderRadius: 4, fontSize: 12, background: "var(--bg-secondary)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }}>ESC</kbd>
            </form>
          </div>
        </div>
      )}

      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={() => setMenuOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(320px, 85vw)", background: "var(--bg-card)", padding: 24, animation: "slideIn .3s ease-out", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>Menu</span>
              <button onClick={() => setMenuOpen(false)} style={{ padding: 8, border: "none", background: "none", cursor: "pointer", color: "var(--text-secondary)" }}><Icon name="close" size={24} /></button>
            </div>
            {["Home", "Categories", "Trending", "About"].map(item => (
              <button key={item} onClick={() => { setPage({ name: item.toLowerCase() }); setMenuOpen(false); }} style={{ padding: "14px 16px", border: "none", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", fontSize: 16, fontWeight: 500, color: "var(--text-primary)", textAlign: "left" }}>{item}</button>
            ))}
            <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
            {categories?.map(cat => (
              <button key={cat.id} onClick={() => { setPage({ name: "category", id: cat.id }); setMenuOpen(false); }} style={{ padding: "10px 16px", border: "none", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}><span>{cat.icon}</span> {cat.name}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════
// ARTICLE CARDS
// ═══════════════════════════════════════════════

const ArticleCard = ({ article, variant = "default", index = 0 }) => {
  const { setPage, categories } = useApp();
  const cat = categories?.find(c => c.id === article.category);

  if (variant === "featured") {
    return (
      <article onClick={() => setPage({ name: "article", id: article.id })} className="animate-in"
        style={{ cursor: "pointer", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)", transition: "var(--transition)", animationDelay: `${index * 0.1}s`, animationFillMode: "backwards", display: "grid", gridTemplateColumns: "1fr 1fr" }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-lg)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(0)"; }}>
        <style>{`.featured-grid { grid-template-columns: 1fr 1fr; } @media(max-width:768px){ .featured-grid { grid-template-columns:1fr !important; } }`}</style>
        <div style={{ aspectRatio: "16/10", background: `url(${article.coverImage}) center/cover`, minHeight: 240 }} />
        <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {cat && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: "var(--radius-xl)", background: cat.color + "15", color: cat.color, fontSize: 12, fontWeight: 600, marginBottom: 12, width: "fit-content", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat.icon} {cat.name}</span>}
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.25rem,2vw,1.75rem)", lineHeight: 1.3, marginBottom: 12 }}>{article.title}</h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.excerpt}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "var(--text-tertiary)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={14} /> {article.readTime} min read</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="eye" size={14} /> {article.views?.toLocaleString()}</span>
            <span>{formatDate(article.publishedAt || article.createdAt)}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article onClick={() => setPage({ name: "article", id: article.id })} className="animate-in"
      style={{ cursor: "pointer", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", transition: "var(--transition)", animationDelay: `${index * 0.08}s`, animationFillMode: "backwards" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      {article.coverImage && (
        <div style={{ aspectRatio: "16/9", background: `url(${article.coverImage}) center/cover`, position: "relative" }}>
          {cat && <span style={{ position: "absolute", top: 12, left: 12, padding: "4px 10px", borderRadius: "var(--radius-xl)", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", color: "white", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat.icon} {cat.name}</span>}
        </div>
      )}
      <div style={{ padding: "20px 20px 18px" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", lineHeight: 1.35, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.title}</h3>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.excerpt}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-tertiary)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Icon name="clock" size={13} /> {article.readTime}m</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Icon name="heart" size={13} /> {article.likes}</span>
          </div>
          <span>{formatDate(article.publishedAt || article.createdAt)}</span>
        </div>
      </div>
    </article>
  );
};

const ArticleCardCompact = ({ article, index = 0 }) => {
  const { setPage } = useApp();
  return (
    <article onClick={() => setPage({ name: "article", id: article.id })} className="animate-in" style={{ cursor: "pointer", display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--border-light)", transition: "var(--transition)", animationDelay: `${index * 0.06}s`, animationFillMode: "backwards" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--border)", lineHeight: 1, minWidth: 32 }}>{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, lineHeight: 1.4, marginBottom: 4 }}>{article.title}</h4>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-tertiary)" }}><span>{article.readTime}m read</span><span>{article.views?.toLocaleString()} views</span></div>
        </div>
      </div>
      {article.coverImage && <div style={{ width: 72, height: 72, borderRadius: "var(--radius-sm)", flexShrink: 0, background: `url(${article.coverImage}) center/cover` }} />}
    </article>
  );
};

// ═══════════════════════════════════════════════
// NEWSLETTER
// ═══════════════════════════════════════════════

const NewsletterSection = ({ variant = "default" }) => {
  const { addToast, triggerRefresh } = useApp();
  const [email, setEmail] = useState("");

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    const subs = DB.get("subscribers:index") || [];
    if (subs.includes(email)) { addToast("You're already subscribed!", "info"); }
    else { subs.push(email); DB.set("subscribers:index", subs); DB.set(`subscriber:${email}`, { email, subscribedAt: new Date().toISOString() }); addToast("Successfully subscribed! Welcome aboard.", "success"); triggerRefresh(); }
    setEmail("");
  };

  if (variant === "minimal") {
    return (
      <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 8, maxWidth: 400 }}>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" required style={{ flex: 1, padding: "10px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
        <button type="submit" style={{ padding: "10px 20px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Subscribe</button>
      </form>
    );
  }

  return (
    <section style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "clamp(32px,5vw,56px)", textAlign: "center", margin: "48px 0" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.5rem,3vw,2rem)", marginBottom: 8 }}>Stay in the loop</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 16, maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.6 }}>Get the latest stories delivered straight to your inbox. No spam, ever.</p>
      <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 10, maxWidth: 460, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Enter your email address" required style={{ flex: "1 1 240px", padding: "14px 20px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 15, outline: "none" }} />
        <button type="submit" style={{ padding: "14px 32px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Subscribe</button>
      </form>
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 12 }}>Unsubscribe anytime.</p>
    </section>
  );
};

// ═══════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════

const HomePage = () => {
  const { posts, categories, setPage } = useApp();
  const published = posts.filter(p => p.status === "published");
  const featured = published.filter(p => p.featured).slice(0, 2);
  const latest = published.slice(0, 9);
  const trending = [...published].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  return (
    <div>
      {featured.length > 0 && (
        <section className="container" style={{ paddingTop: 40, paddingBottom: 32 }}>
          <div style={{ display: "grid", gap: 24 }}>{featured.map((a, i) => <ArticleCard key={a.id} article={a} variant="featured" index={i} />)}</div>
        </section>
      )}
      <section className="container" style={{ paddingBottom: 48 }}>
        <div className="main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>Latest Stories</h2>
              <div style={{ height: 1, flex: 1, background: "var(--border)", margin: "0 20px" }} />
              <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>{published.length} articles</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>{latest.map((a, i) => <ArticleCard key={a.id} article={a} index={i} />)}</div>
          </div>
          <aside>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><Icon name="trending" size={18} /> Trending Now</h3>
              {trending.map((a, i) => <ArticleCardCompact key={a.id} article={a} index={i} />)}
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: 16 }}>Explore Topics</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {categories?.map(cat => (
                  <button key={cat.id} onClick={() => setPage({ name: "category", id: cat.id })} style={{ padding: "8px 14px", borderRadius: "var(--radius-xl)", border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}><span>{cat.icon}</span> {cat.name}</button>
                ))}
              </div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: 8 }}>Newsletter</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>Weekly digest of our best stories.</p>
              <NewsletterSection variant="minimal" />
            </div>
          </aside>
        </div>
      </section>
      <div className="container"><NewsletterSection /></div>
    </div>
  );
};

// ═══════════════════════════════════════════════
// ARTICLE PAGE
// ═══════════════════════════════════════════════

const ArticlePage = ({ articleId }) => {
  const { posts, categories, currentUser, setPage, addToast, triggerRefresh } = useApp();
  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [guestName, setGuestName] = useState("");
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const post = DB.get(`post:${articleId}`);
    if (post) {
      post.views = (post.views || 0) + 1;
      DB.set(`post:${post.id}`, post);
      setArticle(post);
      const allCommentIds = DB.get("comments:index") || [];
      const postComments = [];
      for (const cid of allCommentIds) { const c = DB.get(`comment:${cid}`); if (c && c.postId === articleId) postComments.push(c); }
      setComments(postComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      if (currentUser) { const bm = DB.get(`bookmarks:${currentUser.id}`) || []; setBookmarked(bm.includes(articleId)); }
    }
    window.scrollTo(0, 0);
  }, [articleId, currentUser]);

  const handleLike = () => { if (!article) return; const n = !liked; setLiked(n); article.likes = (article.likes || 0) + (n ? 1 : -1); setArticle({ ...article }); DB.set(`post:${article.id}`, article); };

  const handleBookmark = () => {
    if (!currentUser) { addToast("Please sign in to bookmark", "info"); return; }
    const bm = DB.get(`bookmarks:${currentUser.id}`) || [];
    if (bookmarked) { const i = bm.indexOf(articleId); if (i > -1) bm.splice(i, 1); addToast("Removed from bookmarks", "info"); }
    else { bm.push(articleId); addToast("Saved to bookmarks!", "success"); }
    DB.set(`bookmarks:${currentUser.id}`, bm);
    setBookmarked(!bookmarked);
  };

  const handleComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!currentUser && !guestName.trim()) { addToast("Please enter your name", "info"); return; }
    const comment = { id: generateId(), postId: articleId, author: currentUser?.id || "guest", authorName: currentUser?.displayName || guestName.trim(), content: commentText.trim(), createdAt: new Date().toISOString(), likes: 0 };
    DB.set(`comment:${comment.id}`, comment);
    const idx = DB.get("comments:index") || []; idx.push(comment.id); DB.set("comments:index", idx);
    setComments([comment, ...comments]); setCommentText(""); addToast("Comment posted!", "success");
  };

  if (!article) return <div className="container" style={{ padding: "80px 0", textAlign: "center" }}><div className="skeleton" style={{ width: "60%", height: 40, margin: "0 auto 20px" }} /><div className="skeleton" style={{ width: "100%", maxWidth: 800, height: 400, margin: "0 auto" }} /></div>;

  const cat = categories?.find(c => c.id === article.category);
  const relatedPosts = posts.filter(p => p.id !== articleId && p.category === article.category && p.status === "published").slice(0, 3);

  return (
    <article className="container" style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 13, color: "var(--text-tertiary)" }}>
        <span style={{ cursor: "pointer" }} onClick={() => setPage({ name: "home" })}>Home</span><Icon name="chevronRight" size={12} />
        {cat && <><span style={{ cursor: "pointer", color: cat.color }} onClick={() => setPage({ name: "category", id: cat.id })}>{cat.name}</span><Icon name="chevronRight" size={12} /></>}
        <span style={{ color: "var(--text-secondary)" }}>Article</span>
      </div>
      <h1 className="animate-up" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.75rem,4vw,2.75rem)", lineHeight: 1.2, marginBottom: 16, letterSpacing: "-0.02em" }}>{article.title}</h1>
      <div className="animate-in" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar src={null} name={article.authorName} size={40} fontSize={16} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{article.authorName}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{formatDate(article.publishedAt || article.createdAt)} · {article.readTime} min read</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button onClick={handleLike} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: liked ? "var(--accent-light)" : "var(--bg-card)", color: liked ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}><Icon name={liked ? "heartFill" : "heart"} size={16} /> {article.likes}</button>
          <button onClick={handleBookmark} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: bookmarked ? "var(--accent-light)" : "var(--bg-card)", color: bookmarked ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}><Icon name={bookmarked ? "bookmarkFill" : "bookmark"} size={16} /></button>
          <button onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(window.location.href); addToast("Link copied!", "success"); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}><Icon name="share" size={16} /></button>
        </div>
      </div>
      {article.coverImage && <div className="animate-up" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 40, aspectRatio: "16/8", background: `url(${article.coverImage}) center/cover` }} />}
      <div className="article-body" style={{ fontFamily: "var(--font-body)", fontSize: "1.125rem", lineHeight: 1.85, color: "var(--text-secondary)", marginBottom: 48 }} dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(article.content)}</p>` }} />
      {article.tags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 48, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
          <Icon name="tag" size={16} style={{ color: "var(--text-tertiary)", marginTop: 6 }} />
          {article.tags.map(tag => <span key={tag} onClick={() => setPage({ name: "search", query: tag })} style={{ padding: "6px 14px", borderRadius: "var(--radius-xl)", background: "var(--bg-secondary)", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", fontWeight: 500 }}>#{tag}</span>)}
        </div>
      )}
      <section style={{ borderTop: "1px solid var(--border)", paddingTop: 40 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.375rem", marginBottom: 24 }}>Comments ({comments.length})</h3>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Avatar src={currentUser?.avatar} name={currentUser?.displayName || "G"} size={36} />
            <div>{currentUser ? <span style={{ fontWeight: 600, fontSize: 14 }}>{currentUser.displayName}</span> : <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your name (guest)" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 12px", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />}</div>
          </div>
          <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Share your thoughts..." rows={3} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "12px 16px", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none", marginBottom: 12 }} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleComment} disabled={!commentText.trim()} style={{ padding: "10px 24px", border: "none", borderRadius: "var(--radius-xl)", background: commentText.trim() ? "var(--accent)" : "var(--bg-secondary)", color: commentText.trim() ? "white" : "var(--text-tertiary)", cursor: commentText.trim() ? "pointer" : "default", fontSize: 14, fontWeight: 600 }}>Post Comment</button>
          </div>
        </div>
        {comments.length === 0 ? <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "32px 0", fontSize: 15 }}>No comments yet. Be the first!</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {comments.map((c, i) => (
              <div key={c.id} className="animate-in" style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", animationDelay: `${i * 0.05}s` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Avatar src={null} name={c.authorName} size={32} fontSize={12} />
                  <div><span style={{ fontWeight: 600, fontSize: 14 }}>{c.authorName}</span>{c.author === "guest" && <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 6, padding: "1px 6px", background: "var(--bg-secondary)", borderRadius: 4 }}>Guest</span>}</div>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: "auto" }}>{formatDate(c.createdAt)}</span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      {relatedPosts.length > 0 && (
        <section style={{ marginTop: 64 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.375rem", marginBottom: 24 }}>You might also enjoy</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 20 }}>{relatedPosts.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div>
        </section>
      )}
    </article>
  );
};

// ═══════════════════════════════════════════════
// WRITE / EDIT POST
// ═══════════════════════════════════════════════

const WritePage = ({ editId = null }) => {
  const { currentUser, setPage, addToast, categories, triggerRefresh } = useApp();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState("draft");
  const [featured, setFeatured] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser) { setPage({ name: "login" }); return; }
    if (editId) {
      const post = DB.get(`post:${editId}`);
      if (post) { setTitle(post.title); setContent(post.content); setExcerpt(post.excerpt || ""); setCategory(post.category); setTags(post.tags?.join(", ") || ""); setCoverUrl(post.coverImage || ""); setStatus(post.status); setFeatured(post.featured || false); }
    }
  }, [editId, currentUser, setPage]);

  const handleImageUpload = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setCoverUrl(ev.target.result); r.readAsDataURL(f); };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) { addToast("Title and content are required", "error"); return; }
    const existing = editId ? DB.get(`post:${editId}`) : null;
    const postData = {
      id: editId || `post-${generateId()}`, title: title.trim(), slug: slugify(title), content: content.trim(),
      excerpt: excerpt.trim() || content.trim().substring(0, 150) + "...", category: category || "tech",
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      coverImage: coverUrl || "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=400&fit=crop",
      author: currentUser.id, authorName: currentUser.displayName, status, featured,
      readTime: estimateReadTime(content), views: existing?.views || 0, likes: existing?.likes || 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      publishedAt: status === "published" ? (existing?.publishedAt || new Date().toISOString()) : null,
      updatedAt: new Date().toISOString(),
    };
    DB.set(`post:${postData.id}`, postData);
    const idx = DB.get("posts:index") || [];
    if (!idx.includes(postData.id)) { idx.unshift(postData.id); DB.set("posts:index", idx); }
    triggerRefresh();
    addToast(editId ? "Article updated!" : "Article created!", "success");
    setPage({ name: "article", id: postData.id });
  };

  if (!currentUser) return null;
  const inputStyle = { width: "100%", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" };

  return (
    <div className="container" style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>{editId ? "Edit Article" : "Write New Article"}</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setPreview(!preview)} style={{ padding: "10px 20px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: preview ? "var(--accent-light)" : "var(--bg-card)", color: preview ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>{preview ? "Edit" : "Preview"}</button>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 16px" }}><option value="draft">Draft</option><option value="published">Published</option></select>
          <button onClick={handleSave} style={{ padding: "10px 24px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>{editId ? "Update" : "Publish"}</button>
        </div>
      </div>
      {preview ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "40px 32px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem", marginBottom: 16 }}>{title || "Untitled"}</h1>
          {coverUrl && <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 24, aspectRatio: "16/8", background: `url(${coverUrl}) center/cover` }} />}
          <div className="article-body" dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(content)}</p>` }} style={{ fontSize: "1.125rem", lineHeight: 1.85, color: "var(--text-secondary)" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title..." style={{ ...inputStyle, fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, padding: "16px 20px", border: "none", borderBottom: "2px solid var(--border)" }} />
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Cover Image</label>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="Paste image URL or upload..." style={{ ...inputStyle, flex: 1 }} />
              <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
              <button onClick={() => fileInputRef.current?.click()} style={{ padding: "12px 18px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><Icon name="image" size={16} /> Upload</button>
            </div>
            {coverUrl && <div style={{ marginTop: 12, borderRadius: "var(--radius-md)", overflow: "hidden", aspectRatio: "16/6", background: `url(${coverUrl}) center/cover`, border: "1px solid var(--border)" }} />}
          </div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Excerpt / Summary</label><textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="A brief summary..." rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Category</label><select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}><option value="">Select category...</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
            <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Tags</label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="comma, separated, tags" style={inputStyle} /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}><input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} /><span style={{ fontWeight: 500 }}>Feature this article on the homepage</span></label>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Content</label>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Markdown supported — {estimateReadTime(content)} min read · {content.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your article here... Use Markdown for formatting" rows={20} style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.7, resize: "vertical", minHeight: 400 }} />
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// AUTH PAGE
// ═══════════════════════════════════════════════

const AuthPage = ({ mode = "login" }) => {
  const { login, setPage, addToast } = useApp();
  const [isLogin, setIsLogin] = useState(mode === "login");
  const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "" });

  const handleSubmit = () => {
    if (isLogin) {
      const usersIdx = DB.get("users:index") || [];
      let foundUser = null;
      for (const uid of usersIdx) { const u = DB.get(`user:${uid}`); if (u && (u.username === form.username || u.email === form.username) && u.password === form.password) { foundUser = u; break; } }
      if (foundUser) { login(foundUser); addToast(`Welcome back, ${foundUser.displayName}!`, "success"); setPage({ name: "home" }); }
      else { addToast("Invalid credentials. Try admin / admin123", "error"); }
    } else {
      if (!form.username || !form.email || !form.password || !form.displayName) { addToast("Please fill all fields", "error"); return; }
      const newUser = { id: `user-${generateId()}`, username: form.username, email: form.email, password: form.password, displayName: form.displayName, role: "author", avatar: null, bio: "", joinedAt: new Date().toISOString() };
      DB.set(`user:${newUser.id}`, newUser);
      const idx = DB.get("users:index") || []; idx.push(newUser.id); DB.set("users:index", idx);
      login(newUser); addToast("Account created! Welcome.", "success"); setPage({ name: "home" });
    }
  };

  const inputStyle = { width: "100%", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" };

  return (
    <div style={{ minHeight: "calc(100vh - var(--header-height))", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="animate-up" style={{ maxWidth: 420, width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "40px 32px", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "white", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24 }}>P</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", marginBottom: 4 }}>{isLogin ? "Welcome back" : "Join The Pulse"}</h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{isLogin ? "Sign in to your account" : "Create your free account"}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!isLogin && <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Display Name</label><input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="John Doe" style={inputStyle} /></div>}
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>{isLogin ? "Username or Email" : "Username"}</label><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder={isLogin ? "admin" : "johndoe"} style={inputStyle} /></div>
          {!isLogin && <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" placeholder="john@example.com" style={inputStyle} /></div>}
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Password</label><input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder={isLogin ? "admin123" : "••••••••"} style={inputStyle} /></div>
          <button onClick={handleSubmit} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>{isLogin ? "Sign In" : "Create Account"}</button>
        </div>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-tertiary)" }}>{isLogin ? "Don't have an account? " : "Already have an account? "}<span onClick={() => setIsLogin(!isLogin)} style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>{isLogin ? "Sign Up" : "Sign In"}</span></p>
        {isLogin && <p style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--text-tertiary)", padding: "12px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)" }}>Demo: username <strong>admin</strong> / password <strong>admin123</strong></p>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════
// PROFILE PAGE (with avatar, email, password change)
// ═══════════════════════════════════════════════

const ProfilePage = () => {
  const { currentUser, setCurrentUser, addToast } = useApp();
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const avatarRef = useRef(null);

  if (!currentUser) return null;
  const inputStyle = { width: "100%", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none" };

  const handleAvatarUpload = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const updated = { ...currentUser, avatar: ev.target.result };
      DB.set(`user:${currentUser.id}`, updated); setCurrentUser(updated); addToast("Profile picture updated!", "success");
    };
    r.readAsDataURL(f);
  };

  const handleSaveProfile = () => {
    const updated = { ...currentUser, bio, displayName, email };
    DB.set(`user:${currentUser.id}`, updated); setCurrentUser(updated); addToast("Profile updated!", "success");
  };

  const handleChangePassword = () => {
    if (currentPassword !== currentUser.password) { addToast("Current password is incorrect", "error"); return; }
    if (newPassword.length < 6) { addToast("New password must be at least 6 characters", "error"); return; }
    if (newPassword !== confirmPassword) { addToast("Passwords don't match", "error"); return; }
    const updated = { ...currentUser, password: newPassword };
    DB.set(`user:${currentUser.id}`, updated); setCurrentUser(updated);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    addToast("Password changed successfully!", "success");
  };

  return (
    <div className="container" style={{ padding: "40px 24px 80px", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", marginBottom: 32 }}>My Profile</h1>

      {/* Profile Info Card */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 32, marginBottom: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <Avatar src={currentUser.avatar} name={displayName} size={80} fontSize={32} />
            <button onClick={() => avatarRef.current?.click()} style={{ position: "absolute", bottom: -4, right: -4, width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "white", border: "3px solid var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="camera" size={14} /></button>
            <input type="file" ref={avatarRef} accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
          </div>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 12 }}>Member since {formatDate(currentUser.joinedAt)} · Role: {currentUser.role}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Display Name</label><input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Email</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Bio</label><textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="Tell readers about yourself..." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} /></div>
          <button onClick={handleSaveProfile} style={{ padding: "12px 24px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600, alignSelf: "flex-end" }}>Save Changes</button>
        </div>
      </div>

      {/* Change Password Card */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 32 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}><Icon name="lock" size={18} /> Change Password</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Current Password</label><input value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} type="password" placeholder="Enter current password" style={inputStyle} /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>New Password</label><input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="Enter new password (min 6 chars)" style={inputStyle} /></div>
          <div><label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Confirm New Password</label><input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm new password" style={inputStyle} /></div>
          <button onClick={handleChangePassword} style={{ padding: "12px 24px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600, alignSelf: "flex-end" }}>Update Password</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════
// ADMIN DASHBOARD (with working edit/delete)
// ═══════════════════════════════════════════════

const AdminDashboard = () => {
  const { posts, currentUser, setPage, addToast, triggerRefresh, categories } = useApp();
  const [activeTab, setActiveTab] = useState("overview");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const subscribers = useMemo(() => {
    const subsIdx = DB.get("subscribers:index") || [];
    return subsIdx.map(email => DB.get(`subscriber:${email}`)).filter(Boolean);
  }, [posts]); // re-derive on refresh

  const comments = useMemo(() => {
    const commIdx = DB.get("comments:index") || [];
    return commIdx.map(cid => DB.get(`comment:${cid}`)).filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [posts]);

  if (!currentUser || currentUser.role !== "admin") {
    return <div className="container" style={{ padding: "80px 0", textAlign: "center" }}><h2>Access Denied</h2><p style={{ color: "var(--text-tertiary)" }}>Admin access required.</p></div>;
  }

  const published = posts.filter(p => p.status === "published");
  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);

  const handleDelete = (id) => {
    DB.delete(`post:${id}`);
    const idx = DB.get("posts:index") || [];
    DB.set("posts:index", idx.filter(i => i !== id));
    triggerRefresh();
    addToast("Article deleted", "info");
    setDeleteConfirmId(null);
  };

  const handleDeleteComment = (cid) => {
    DB.delete(`comment:${cid}`);
    const idx = DB.get("comments:index") || [];
    DB.set("comments:index", idx.filter(i => i !== cid));
    triggerRefresh();
    addToast("Comment removed", "info");
  };

  const stats = [
    { label: "Total Articles", value: posts.length, icon: "edit", color: "var(--accent)" },
    { label: "Published", value: published.length, icon: "globe", color: "var(--accent-secondary)" },
    { label: "Total Views", value: totalViews.toLocaleString(), icon: "eye", color: "#8b5cf6" },
    { label: "Total Likes", value: totalLikes.toLocaleString(), icon: "heart", color: "#ef4444" },
    { label: "Comments", value: comments.length, icon: "comment", color: "#f59e0b" },
    { label: "Subscribers", value: subscribers.length, icon: "mail", color: "#06b6d4" },
  ];

  const tabStyle = (active) => ({ padding: "10px 18px", border: "none", borderRadius: "var(--radius-xl)", background: active ? "var(--accent)" : "var(--bg-secondary)", color: active ? "white" : "var(--text-secondary)", cursor: "pointer", fontSize: 14, fontWeight: 500 });

  return (
    <div className="container" style={{ padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.75rem" }}><Icon name="dashboard" size={24} style={{ verticalAlign: "middle", marginRight: 8 }} /> Dashboard</h1>
        <button onClick={() => setPage({ name: "write" })} style={{ padding: "10px 24px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Icon name="plus" size={16} /> New Article</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <div key={s.label} className="animate-in" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 20, animationDelay: `${i * 0.05}s`, animationFillMode: "backwards" }}>
            <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: s.color + "15", color: s.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}><Icon name={s.icon} size={16} /></div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {["overview", "articles", "comments", "subscribers"].map(tab => <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}
      </div>

      {activeTab === "overview" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 16 }}>Recent Articles</h3>
          {posts.slice(0, 8).map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < 7 ? "1px solid var(--border-light)" : "none", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{p.views} views · {p.likes} likes · {formatDate(p.createdAt)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <span style={{ padding: "3px 10px", borderRadius: "var(--radius-xl)", fontSize: 11, fontWeight: 600, background: p.status === "published" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", color: p.status === "published" ? "#10b981" : "#f59e0b" }}>{p.status}</span>
                <button onClick={() => setPage({ name: "edit", id: p.id })} style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "var(--accent)" }}><Icon name="edit" size={14} /></button>
                <button onClick={() => setDeleteConfirmId(p.id)} style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "#ef4444" }}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "articles" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>{["Title", "Category", "Status", "Views", "Likes", "Date", "Actions"].map(h => <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>
                {posts.map(p => {
                  const cat = categories?.find(c => c.id === p.category);
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{cat ? `${cat.icon} ${cat.name}` : "-"}</td>
                      <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: "var(--radius-xl)", fontSize: 11, fontWeight: 600, background: p.status === "published" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", color: p.status === "published" ? "#10b981" : "#f59e0b" }}>{p.status}</span></td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{p.views?.toLocaleString()}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{p.likes}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{formatDate(p.createdAt)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setPage({ name: "article", id: p.id })} title="View" style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "var(--text-secondary)" }}><Icon name="eye" size={14} /></button>
                          <button onClick={() => setPage({ name: "edit", id: p.id })} title="Edit" style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "var(--accent)" }}><Icon name="edit" size={14} /></button>
                          <button onClick={() => setDeleteConfirmId(p.id)} title="Delete" style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "#ef4444" }}><Icon name="trash" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "comments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {comments.length === 0 ? <p style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No comments yet.</p> : comments.map(c => (
            <div key={c.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.authorName}<span style={{ color: "var(--text-tertiary)", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{formatDate(c.createdAt)}</span></div><p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>{c.content}</p><span onClick={() => setPage({ name: "article", id: c.postId })} style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer" }}>View Article →</span></div>
              <button onClick={() => handleDeleteComment(c.id)} style={{ padding: 6, border: "none", background: "none", cursor: "pointer", color: "#ef4444", flexShrink: 0 }}><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "subscribers" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {subscribers.length === 0 ? <p style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No subscribers yet.</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>{["Email", "Subscribed Date"].map(h => <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 12, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
              <tbody>{subscribers.map(s => <tr key={s.email} style={{ borderBottom: "1px solid var(--border-light)" }}><td style={{ padding: "12px 16px" }}>{s.email}</td><td style={{ padding: "12px 16px", color: "var(--text-tertiary)" }}>{formatDate(s.subscribedAt)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: "100%", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", padding: "32px", boxShadow: "var(--shadow-xl)", animation: "fadeInUp .3s ease-out" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", marginBottom: 12 }}>Delete Article?</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>This action cannot be undone. The article will be permanently removed.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: "10px 20px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} style={{ padding: "10px 20px", border: "none", borderRadius: "var(--radius-xl)", background: "#ef4444", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// SECONDARY PAGES
// ═══════════════════════════════════════════════

const CategoriesPage = () => {
  const { categories, posts, setPage } = useApp();
  return (
    <div className="container" style={{ padding: "40px 24px 80px" }}>
      <h1 className="animate-up" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.75rem,3vw,2.5rem)", marginBottom: 32, textAlign: "center" }}>Explore Topics</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20, maxWidth: 900, margin: "0 auto" }}>
        {categories?.map((cat, i) => {
          const count = posts.filter(p => p.category === cat.id && p.status === "published").length;
          return (
            <div key={cat.id} className="animate-in" onClick={() => setPage({ name: "category", id: cat.id })}
              style={{ padding: 28, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", cursor: "pointer", transition: "var(--transition)", animationDelay: `${i * 0.05}s`, animationFillMode: "backwards", borderLeft: `4px solid ${cat.color}` }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
              <span style={{ fontSize: 32, marginBottom: 12, display: "block" }}>{cat.icon}</span>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", marginBottom: 4 }}>{cat.name}</h3>
              <p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{count} article{count !== 1 ? "s" : ""}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CategoryPage = ({ categoryId }) => {
  const { categories, posts, setPage } = useApp();
  const cat = categories?.find(c => c.id === categoryId);
  const catPosts = posts.filter(p => p.category === categoryId && p.status === "published");
  return (
    <div className="container" style={{ padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 13, color: "var(--text-tertiary)" }}>
        <span style={{ cursor: "pointer" }} onClick={() => setPage({ name: "home" })}>Home</span><Icon name="chevronRight" size={12} />
        <span style={{ cursor: "pointer" }} onClick={() => setPage({ name: "categories" })}>Categories</span><Icon name="chevronRight" size={12} />
        <span style={{ color: cat?.color }}>{cat?.name}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}><span style={{ fontSize: 48 }}>{cat?.icon}</span><div><h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "2rem" }}>{cat?.name}</h1><p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{catPosts.length} articles</p></div></div>
      {catPosts.length === 0 ? <p style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>No articles in this category yet.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 24 }}>{catPosts.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div>}
    </div>
  );
};

const TrendingPage = () => {
  const { posts } = useApp();
  const trending = [...posts].filter(p => p.status === "published").sort((a, b) => (b.views || 0) - (a.views || 0));
  return (
    <div className="container" style={{ padding: "40px 24px 80px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}><h1 className="animate-up" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.75rem,3vw,2.5rem)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}><Icon name="fire" size={32} /> Trending Stories</h1><p style={{ color: "var(--text-tertiary)", marginTop: 8 }}>Most popular articles by reader engagement</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>{trending.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div>
    </div>
  );
};

const SearchPage = ({ query }) => {
  const { posts } = useApp();
  const q = query.toLowerCase();
  const results = posts.filter(p => p.status === "published" && (p.title.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)) || p.excerpt?.toLowerCase().includes(q)));
  return (
    <div className="container" style={{ padding: "40px 24px 80px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}><p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 4 }}>Search results for</p><h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.75rem" }}>"{query}"</h1><p style={{ color: "var(--text-tertiary)", fontSize: 14, marginTop: 4 }}>{results.length} result{results.length !== 1 ? "s" : ""}</p></div>
      {results.length === 0 ? <div style={{ textAlign: "center", padding: 60 }}><p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p><p style={{ color: "var(--text-tertiary)", fontSize: 16 }}>No articles found matching your search.</p></div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>{results.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div>}
    </div>
  );
};

const BookmarksPage = () => {
  const { currentUser, posts } = useApp();
  const bookmarkedPosts = useMemo(() => {
    if (!currentUser) return [];
    const bm = DB.get(`bookmarks:${currentUser.id}`) || [];
    return bm.map(id => DB.get(`post:${id}`)).filter(Boolean);
  }, [currentUser, posts]);
  if (!currentUser) return <div className="container" style={{ padding: "80px 0", textAlign: "center" }}><p>Please sign in to view bookmarks.</p></div>;
  return (
    <div className="container" style={{ padding: "40px 24px 80px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.75rem", marginBottom: 32 }}><Icon name="bookmark" size={24} style={{ verticalAlign: "middle", marginRight: 8 }} /> My Bookmarks</h1>
      {bookmarkedPosts.length === 0 ? <div style={{ textAlign: "center", padding: 60 }}><p style={{ fontSize: 48, marginBottom: 16 }}>📑</p><p style={{ color: "var(--text-tertiary)" }}>No bookmarks yet. Save articles to read later!</p></div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>{bookmarkedPosts.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div>}
    </div>
  );
};

const AboutPage = () => (
  <div className="container" style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
    <div className="animate-up">
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(2rem,4vw,3rem)", marginBottom: 24, lineHeight: 1.2, textAlign: "center" }}>About The Pulse</h1>
      <div style={{ width: 60, height: 4, borderRadius: 2, background: "var(--accent)", margin: "0 auto 40px" }} />
      <div style={{ fontSize: "1.125rem", lineHeight: 1.85, color: "var(--text-secondary)" }}>
        <p style={{ marginBottom: 20 }}>The Pulse is a modern digital publication dedicated to delivering thoughtful, well-crafted stories that inform, inspire, and provoke meaningful conversation.</p>
        <p style={{ marginBottom: 20 }}>In an age of information overload, we believe in quality over quantity. Every article published on The Pulse undergoes careful editorial review.</p>
        <p style={{ marginBottom: 32 }}>Whether you're here to learn about the latest developments in AI, discover hidden travel gems, or simply find a good read — we've got something for you.</p>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 32 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", marginBottom: 16 }}>Our Values</h3>
          <div style={{ display: "grid", gap: 16 }}>{[{ i: "✍️", t: "Quality Writing", d: "Every piece is carefully crafted and edited." }, { i: "🔍", t: "Intellectual Curiosity", d: "We explore ideas that matter." }, { i: "🌍", t: "Global Perspective", d: "Stories from and for a diverse world." }, { i: "💡", t: "Independent Voice", d: "We serve readers, not advertisers." }].map(v => <div key={v.t} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}><span style={{ fontSize: 24 }}>{v.i}</span><div><h4 style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{v.t}</h4><p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{v.d}</p></div></div>)}</div>
        </div>
      </div>
    </div>
    <NewsletterSection />
  </div>
);

// ═══════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════

const Footer = () => {
  const { setPage, categories } = useApp();
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", padding: "48px 0 24px" }}>
      <div className="container">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 32, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16 }}>P</div><span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>The Pulse</span></div>
            <p style={{ fontSize: 14, color: "var(--text-tertiary)", lineHeight: 1.6, maxWidth: 260 }}>Thoughtful stories that inform, inspire, and provoke meaningful conversation.</p>
          </div>
          <div>
            <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Quick Links</h4>
            {["Home", "About", "Trending", "Categories"].map(item => <div key={item} onClick={() => setPage({ name: item.toLowerCase() })} style={{ cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, padding: "6px 0" }}>{item}</div>)}
          </div>
          <div>
            <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Topics</h4>
            {categories?.slice(0, 6).map(cat => <div key={cat.id} onClick={() => setPage({ name: "category", id: cat.id })} style={{ cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, padding: "6px 0" }}>{cat.icon} {cat.name}</div>)}
          </div>
          <div>
            <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>Stay Connected</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>Subscribe to our newsletter for weekly updates.</p>
            <NewsletterSection variant="minimal" />
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: 13, color: "var(--text-tertiary)" }}>
          <span>© 2026 The Pulse. All rights reserved.</span>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="https://www.freeprivacypolicy.com/" target="_blank" rel="noopener noreferrer" style={{ cursor: "pointer", color: "var(--text-tertiary)" }}>Privacy Policy</a>
            <a href="https://www.termsfeed.com/public/live/generic" target="_blank" rel="noopener noreferrer" style={{ cursor: "pointer", color: "var(--text-tertiary)" }}>Terms of Service</a>
            <span onClick={() => setPage({ name: "about" })} style={{ cursor: "pointer" }}>Contact</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ═══════════════════════════════════════════════
// BACK TO TOP
// ═══════════════════════════════════════════════

const BackToTop = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const fn = () => setVisible(window.scrollY > 400); window.addEventListener("scroll", fn); return () => window.removeEventListener("scroll", fn); }, []);
  return <button className={`back-to-top ${visible ? "visible" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Icon name="arrowUp" size={20} /></button>;
};

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════

export default function App() {
  const [page, setPage] = useState({ name: "home" });
  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState("light");
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const addToast = useCallback((message, type = "info") => { const id = generateId(); setToasts(prev => [...prev, { id, message, type }]); setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500); }, []);

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const loadPosts = useCallback(() => {
    const idx = DB.get("posts:index") || [];
    const loaded = idx.map(id => DB.get(`post:${id}`)).filter(Boolean);
    loaded.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setPosts(loaded);
  }, []);

  useEffect(() => {
    const cats = DB.get("categories");
    setCategories(cats || []);
    loadPosts();
  }, [loadPosts, refreshKey]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const login = useCallback((user) => setCurrentUser(user), []);
  const logout = useCallback(() => { setCurrentUser(null); setPage({ name: "home" }); addToast("Signed out successfully", "info"); }, [addToast]);
  const toggleTheme = useCallback(() => setTheme(prev => prev === "light" ? "dark" : "light"), []);

  const contextValue = useMemo(() => ({
    page, setPage, currentUser, setCurrentUser, login, logout,
    theme, toggleTheme, posts, categories, addToast, triggerRefresh,
  }), [page, currentUser, theme, posts, categories, addToast, triggerRefresh, login, logout, toggleTheme]);

  const renderPage = () => {
    switch (page.name) {
      case "home": return <HomePage />;
      case "article": return <ArticlePage articleId={page.id} />;
      case "write": return <WritePage />;
      case "edit": return <WritePage editId={page.id} />;
      case "login": case "register": return <AuthPage mode={page.name} />;
      case "admin": return <AdminDashboard />;
      case "categories": return <CategoriesPage />;
      case "category": return <CategoryPage categoryId={page.id} />;
      case "trending": return <TrendingPage />;
      case "search": return <SearchPage query={page.query} />;
      case "bookmarks": return <BookmarksPage />;
      case "profile": return <ProfilePage />;
      case "about": return <AboutPage />;
      default: return <HomePage />;
    }
  };

  return (
    <AppContext.Provider value={contextValue}>
      <GlobalStyles />
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <Header />
        <main style={{ flex: 1 }}>{renderPage()}</main>
        <Footer />
        <BackToTop />
        <ToastContainer toasts={toasts} />
      </div>
    </AppContext.Provider>
  );
}
