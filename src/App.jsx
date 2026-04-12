import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";

/*
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  THE JAAGA DESK — Complete Blog Platform                       ║
 * ║  Built for idrisjaaga.com                                      ║
 * ║                                                                ║
 * ║  Features:                                                     ║
 * ║  • Persistent sessions via localStorage                        ║
 * ║  • Role-based access (admin, editor, author, reader)           ║
 * ║  • Email verification flow (placeholder-ready)                 ║
 * ║  • Subscriber management with verification                     ║
 * ║  • Article recommendations & reading suggestions               ║
 * ║  • Enhanced admin dashboard with full control                  ║
 * ║  • Robust database with logging & data integrity               ║
 * ║  • Password show/hide toggle                                   ║
 * ║  • Reading history, reading time tracker, bookmarks            ║
 * ║  • Like system, comment system, share functionality            ║
 * ║  • Dark/light theme with persistence                           ║
 * ║  • Mobile responsive design                                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════
// 1. DATABASE LAYER — localStorage-backed with logging
// ═══════════════════════════════════════════════════════════════

const DB = {
  _log(action, key) {
    try {
      const logs = JSON.parse(localStorage.getItem("db:logs") || "[]");
      logs.push({ action, key, timestamp: new Date().toISOString() });
      // Keep last 500 log entries
      if (logs.length > 500) logs.splice(0, logs.length - 500);
      localStorage.setItem("db:logs", JSON.stringify(logs));
    } catch { /* silent */ }
  },
  get(key) {
    try {
      const raw = localStorage.getItem(`jd:${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(key, value) {
    try {
      localStorage.setItem(`jd:${key}`, JSON.stringify(value));
      this._log("SET", key);
      return true;
    } catch { return false; }
  },
  delete(key) {
    try {
      localStorage.removeItem(`jd:${key}`);
      this._log("DELETE", key);
      return true;
    } catch { return false; }
  },
  getLogs() {
    try { return JSON.parse(localStorage.getItem("db:logs") || "[]"); } catch { return []; }
  },
  clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("jd:")) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem("db:logs");
  },
  getAllKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("jd:")) keys.push(k.replace("jd:", ""));
    }
    return keys;
  },
  getSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("jd:") || k === "db:logs") {
        total += (localStorage.getItem(k) || "").length;
      }
    }
    return total;
  }
};

// ═══════════════════════════════════════════════════════════════
// 2. DATABASE INITIALIZATION — Seed data
// ═══════════════════════════════════════════════════════════════

const ROLES = {
  admin: { level: 100, label: "Admin", color: "#c45d3e", permissions: ["all"] },
  editor: { level: 75, label: "Editor", color: "#8b5cf6", permissions: ["write", "edit_all", "moderate_comments", "manage_categories"] },
  author: { level: 50, label: "Author", color: "#2d6a4f", permissions: ["write", "edit_own"] },
  reader: { level: 10, label: "Reader", color: "#6b7280", permissions: ["read", "comment", "bookmark"] },
};

const initDB = () => {
  if (DB.get("db:version") === 4) return;

  // Categories
  DB.set("categories", [
    { id: "tech", name: "Technology", icon: "💻", color: "#0ea5e9", description: "Latest in tech, AI, and innovation" },
    { id: "lifestyle", name: "Lifestyle", icon: "🌿", color: "#10b981", description: "Living well, productivity, and growth" },
    { id: "business", name: "Business", icon: "📊", color: "#8b5cf6", description: "Strategy, entrepreneurship, and markets" },
    { id: "culture", name: "Culture", icon: "🎭", color: "#f59e0b", description: "Arts, traditions, and society" },
    { id: "science", name: "Science", icon: "🔬", color: "#ef4444", description: "Discoveries, research, and breakthroughs" },
    { id: "travel", name: "Travel", icon: "✈️", color: "#06b6d4", description: "Adventures, destinations, and guides" },
    { id: "food", name: "Food & Recipes", icon: "🍳", color: "#ec4899", description: "Cooking, nutrition, and culinary arts" },
    { id: "opinion", name: "Opinion", icon: "💬", color: "#6366f1", description: "Perspectives, analysis, and commentary" },
  ]);

  // Admin user
  DB.set("user:admin", {
    id: "admin", username: "Idris", displayName: "Idris Jaaga",
    email: "admin@idrisjaaga.com", password: "needForSpeed101$",
    role: "admin", avatar: null, bio: "Founder & Editor-in-Chief of The Jaaga Desk.",
    joinedAt: "2026-01-01T00:00:00Z", verified: true, lastLogin: null,
  });
  DB.set("users:index", ["admin"]);

  // Sample articles
  const articles = [
    {
      id: "post-1", title: "The Future of Artificial Intelligence in 2026",
      slug: "future-of-ai-2026",
      excerpt: "Exploring how AI is reshaping industries, from healthcare to creative arts, and what we can expect in the coming years.",
      content: `Artificial intelligence has moved far beyond simple chatbots and recommendation engines. In 2026, we're witnessing a paradigm shift that touches every corner of human endeavor.\n\n## The Healthcare Revolution\n\nAI-powered diagnostic tools are now achieving accuracy rates that surpass experienced physicians in certain specialties. From detecting early-stage cancers in medical imaging to predicting patient deterioration hours before it occurs, these systems are saving lives daily.\n\n## Creative Industries\n\nThe creative landscape has been transformed. AI doesn't replace human creativity — it amplifies it. Musicians use AI to explore new sonic territories, architects leverage generative design to create structures that were previously impossible to conceive.\n\n## The Ethical Dimension\n\nWith great power comes great responsibility. The AI community is grappling with questions of bias, transparency, and accountability.\n\n## Looking Ahead\n\nThe trajectory is clear: AI will continue to evolve, becoming more capable, more nuanced, and more integrated into our daily lives.`,
      category: "tech", tags: ["AI", "Technology", "Future", "Innovation"],
      author: "admin", authorName: "Idris Jaaga",
      coverImage: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop",
      status: "published", featured: true, readTime: 6, views: 2847, likes: 194,
      createdAt: "2026-04-08T10:00:00Z", publishedAt: "2026-04-08T10:00:00Z"
    },
    {
      id: "post-2", title: "10 Hidden Gems for Solo Travelers in Southeast Asia",
      slug: "hidden-gems-southeast-asia",
      excerpt: "Beyond the tourist trails: discover untouched beaches, secret temples, and authentic local experiences that most travelers miss.",
      content: `Southeast Asia has long been a favorite destination for backpackers and luxury travelers alike. But beyond the well-trodden paths lie hidden treasures.\n\n## 1. Koh Rong Samloem, Cambodia\n\nWhile Koh Rong attracts the party crowd, its smaller sibling offers pristine beaches with bioluminescent plankton.\n\n## 2. Phong Nha, Vietnam\n\nHome to the world's largest cave, Son Doong, this region offers spelunking adventures through vast underground river systems.\n\n## 3. Kampot, Cambodia\n\nA sleepy riverside town famous for its pepper plantations and French colonial architecture.\n\n## Travel Tips\n\n- Learn basic phrases in local languages\n- Travel during shoulder seasons\n- Support local businesses\n- Always carry a reusable water bottle`,
      category: "travel", tags: ["Travel", "Southeast Asia", "Solo Travel"],
      author: "admin", authorName: "Idris Jaaga",
      coverImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop",
      status: "published", featured: true, readTime: 8, views: 1923, likes: 156,
      createdAt: "2026-04-07T14:00:00Z", publishedAt: "2026-04-07T14:00:00Z"
    },
    {
      id: "post-3", title: "The Psychology of Productivity: Why Less is More",
      slug: "psychology-of-productivity",
      excerpt: "Research reveals that working smarter, not harder, is the key to sustainable high performance and lasting fulfillment.",
      content: `In a culture that glorifies hustle, new research is challenging everything we thought we knew about productivity.\n\n## The Myth of the 80-Hour Week\n\nStudies show that productivity per hour drops sharply after 50 hours of work per week.\n\n## Deep Work vs. Shallow Work\n\nOur brains are designed for focused, uninterrupted concentration — not constant context-switching.\n\n## The Power of Rest\n\nRest isn't the opposite of work — it's work's partner. Elite performers take rest as seriously as effort.\n\n## Practical Strategies\n\n- Time-block your calendar for deep work\n- Practice the two-minute rule for quick tasks\n- Build recovery periods into your day\n- Say no to meetings that could be emails`,
      category: "lifestyle", tags: ["Productivity", "Psychology", "Work-Life Balance"],
      author: "admin", authorName: "Idris Jaaga",
      coverImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=400&fit=crop",
      status: "published", featured: false, readTime: 5, views: 3412, likes: 287,
      createdAt: "2026-04-06T09:00:00Z", publishedAt: "2026-04-06T09:00:00Z"
    },
    {
      id: "post-4", title: "Building a Sustainable Business in the Age of Climate Change",
      slug: "sustainable-business-climate",
      excerpt: "How forward-thinking companies are turning environmental responsibility into competitive advantage.",
      content: `Climate change isn't just an environmental issue — it's a business imperative.\n\n## The Business Case\n\nOver 73% of millennials and Gen Z are willing to pay more for sustainable products.\n\n## Circular Economy\n\nForward-thinking companies are designing products for longevity, repairability, and recyclability.\n\n## Supply Chain Transparency\n\nBlockchain technology is enabling unprecedented supply chain visibility.\n\nThe companies that will define the next century are building sustainability into their DNA today.`,
      category: "business", tags: ["Business", "Sustainability", "Climate"],
      author: "admin", authorName: "Idris Jaaga",
      coverImage: "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=800&h=400&fit=crop",
      status: "published", featured: false, readTime: 7, views: 1567, likes: 98,
      createdAt: "2026-04-05T11:00:00Z", publishedAt: "2026-04-05T11:00:00Z"
    },
    {
      id: "post-5", title: "The Renaissance of Fermentation: Ancient Techniques, Modern Kitchen",
      slug: "renaissance-of-fermentation",
      excerpt: "From kimchi to kombucha, discover why fermented foods are the cornerstone of gut health and culinary creativity.",
      content: `Fermentation is humanity's oldest biotechnology. Today, it's experiencing a renaissance.\n\n## Why Fermentation Matters\n\nFermented foods support gut health, boost immunity, and influence mood through the gut-brain axis.\n\n## Getting Started\n\nA mason jar, some salt, and fresh vegetables are enough to begin.\n\n### Simple Sauerkraut\n\nShred cabbage, toss with 2% salt by weight, pack into a jar, and wait 5-7 days.\n\nThe kitchen is your laboratory. Start small, experiment boldly.`,
      category: "food", tags: ["Food", "Fermentation", "Health"],
      author: "admin", authorName: "Idris Jaaga",
      coverImage: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=400&fit=crop",
      status: "published", featured: false, readTime: 6, views: 2134, likes: 175,
      createdAt: "2026-04-04T16:00:00Z", publishedAt: "2026-04-04T16:00:00Z"
    },
    {
      id: "post-6", title: "Quantum Computing Explained: A Beginner's Guide",
      slug: "quantum-computing-beginners-guide",
      excerpt: "Demystifying qubits, superposition, and entanglement — and why quantum computing matters for everyone.",
      content: `Quantum computing sounds like science fiction, but it's rapidly becoming science fact.\n\n## Classical vs. Quantum\n\nClassical computers use bits — 0s and 1s. Quantum computers use qubits, which exist in multiple states simultaneously.\n\n## Entanglement\n\nWhen qubits become entangled, the state of one instantly influences another, regardless of distance.\n\n## Applications\n\n- **Drug Discovery**: Simulating molecular interactions\n- **Cryptography**: Breaking and creating encryption\n- **Climate Modeling**: More accurate simulations\n- **Finance**: Portfolio optimization\n\nQuantum computing won't replace classical computing — it will complement it.`,
      category: "science", tags: ["Quantum Computing", "Science", "Technology"],
      author: "admin", authorName: "Idris Jaaga",
      coverImage: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=400&fit=crop",
      status: "published", featured: true, readTime: 7, views: 4521, likes: 312,
      createdAt: "2026-04-03T08:00:00Z", publishedAt: "2026-04-03T08:00:00Z"
    },
  ];

  const postIndex = [];
  for (const a of articles) {
    DB.set(`post:${a.id}`, a);
    postIndex.push(a.id);
  }
  DB.set("posts:index", postIndex);
  DB.set("comments:index", []);
  DB.set("subscribers:index", []);
  DB.set("activity:log", []);
  DB.set("db:version", 4);
};

initDB();

// ═══════════════════════════════════════════════════════════════
// 3. SET PAGE TITLE & FAVICON
// ═══════════════════════════════════════════════════════════════

if (typeof document !== "undefined") {
  document.title = "The Jaaga Desk — Stories that illuminate";
  // Set favicon to a simple J lettermark
  const link = document.querySelector("link[rel~='icon']") || document.createElement("link");
  link.rel = "icon";
  link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23c45d3e'/><text x='50' y='68' font-size='55' font-family='Georgia,serif' font-weight='bold' fill='white' text-anchor='middle'>J</text></svg>";
  document.head.appendChild(link);
}

// ═══════════════════════════════════════════════════════════════
// 4. UTILITIES
// ═══════════════════════════════════════════════════════════════

const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

const formatDate = (d) => {
  if (!d) return "";
  const dt = new Date(d), now = new Date(), diff = now - dt;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
const readTime = (t) => Math.max(1, Math.ceil((t?.split(/\s+/).length||0)/200));
const genVerifyCode = () => Math.random().toString(36).substr(2,8).toUpperCase();

const canDo = (role, action) => {
  if (!role) return false;
  const r = ROLES[role];
  if (!r) return false;
  if (r.permissions.includes("all")) return true;
  return r.permissions.includes(action);
};

const addActivity = (action, details) => {
  const log = DB.get("activity:log") || [];
  log.unshift({ action, details, timestamp: new Date().toISOString() });
  if (log.length > 200) log.length = 200;
  DB.set("activity:log", log);
};

const renderMd = (text) => {
  if (!text) return "";
  return text
    .replace(/^### (.*$)/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
};

// ═══════════════════════════════════════════════════════════════
// 5. ICON COMPONENT
// ═══════════════════════════════════════════════════════════════

const I = ({ n, s = 20, style: sx = {} }) => {
  const d = {
    home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z",
    search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    comment: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    bookmark: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z",
    share: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z",
    clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    eyeOff: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21",
    edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    plus: "M12 4v16m8-8H4",
    close: "M6 18L18 6M6 6l12 12",
    menu: "M4 6h16M4 12h16M4 18h16",
    chevDown: "M19 9l-7 7-7-7",
    chevRight: "M9 5l7 7-7 7",
    mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    dash: "M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm10-2a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z",
    image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
    trend: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    sun: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    moon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
    fire: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z",
    globe: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    check: "M5 13l4 4L19 7",
    arrowUp: "M5 10l7-7m0 0l7 7m-7-7v18",
    camera: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",
    lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    database: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
    sparkle: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
    x: "M6 18L18 6M6 6l12 12",
  };
  const paths = n === "eye" ? <><path d={d.eye}/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></> : <path d={d[n]}/>;
  return <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, ...sx }}>{paths}</svg>;
};

// ═══════════════════════════════════════════════════════════════
// 6. REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════

const Avatar = ({ src, name, size = 36, fs = 14 }) => {
  if (src) return <div style={{ width:size, height:size, borderRadius:"50%", overflow:"hidden", flexShrink:0 }}><img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /></div>;
  return <div style={{ width:size, height:size, borderRadius:"50%", background:"var(--accent)", color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:fs, flexShrink:0 }}>{name?.[0]?.toUpperCase()||"?"}</div>;
};

const PasswordInput = ({ value, onChange, placeholder, style: sx = {} }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <input type={show?"text":"password"} value={value} onChange={onChange} placeholder={placeholder}
        style={{ ...sx, paddingRight: 44 }} />
      <button type="button" onClick={() => setShow(!show)}
        style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", border:"none", background:"none", cursor:"pointer", color:"var(--text-tertiary)", padding:4, display:"flex" }}>
        <I n={show?"eyeOff":"eye"} s={18} />
      </button>
    </div>
  );
};

const Badge = ({ text, color }) => (
  <span style={{ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:color+"18", color, textTransform:"uppercase", letterSpacing:"0.04em" }}>{text}</span>
);

const Modal = ({ children, onClose, maxWidth = 480 }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", backdropFilter:"blur(4px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, animation:"fadeIn .2s ease-out" }} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg-card)", borderRadius:"var(--radius-lg)", boxShadow:"var(--shadow-xl)", width:"100%", maxWidth, maxHeight:"90vh", overflowY:"auto", animation:"fadeInUp .3s ease-out" }}>{children}</div>
  </div>
);

const ToastContainer = ({ toasts }) => (
  <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
    {toasts.map(t => <div key={t.id} style={{ padding:"14px 20px", borderRadius:"var(--radius-md)", background:"var(--bg-elevated)", border:"1px solid var(--border)", boxShadow:"var(--shadow-lg)", animation:"slideDown .3s ease-out", fontSize:14, fontWeight:500, color:"var(--text-primary)", display:"flex", alignItems:"center", gap:10, borderLeft:`4px solid ${t.type==="success"?"var(--accent-secondary)":t.type==="error"?"#ef4444":"var(--accent)"}` }}>{t.type==="success"?"✓":t.type==="error"?"✕":"ℹ"} {t.message}</div>)}
  </div>
);

// Due to the massive size of this complete application, I need to continue building
// the remaining components. The file will be too large for a single creation, so let
// me structure this as a complete working application.

const inputStyle = {
  width:"100%", padding:"12px 16px", border:"1px solid var(--border)",
  borderRadius:"var(--radius-md)", background:"var(--bg-primary)",
  color:"var(--text-primary)", fontSize:14, outline:"none",
  transition:"border-color .2s", fontFamily:"inherit",
};

// ═══════════════════════════════════════════════════════════════
// 7. STYLES
// ═══════════════════════════════════════════════════════════════

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
    :root {
      --bg-primary:#faf9f7; --bg-secondary:#f0eee9; --bg-card:#fff; --bg-elevated:#fff;
      --text-primary:#1a1a1a; --text-secondary:#5a5a5a; --text-tertiary:#8a8a8a;
      --accent:#c45d3e; --accent-hover:#a84d32; --accent-light:rgba(196,93,62,.08);
      --accent-secondary:#2d6a4f; --border:#e5e2dc; --border-light:#f0eee9;
      --shadow-sm:0 1px 3px rgba(0,0,0,.04); --shadow-md:0 4px 12px rgba(0,0,0,.06);
      --shadow-lg:0 8px 30px rgba(0,0,0,.08); --shadow-xl:0 20px 60px rgba(0,0,0,.1);
      --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-xl:24px;
      --font-display:'Playfair Display',Georgia,serif;
      --font-body:'Source Sans 3','Segoe UI',sans-serif;
      --font-mono:'JetBrains Mono',monospace;
      --max-width:1280px; --header-height:72px; --transition:.2s cubic-bezier(.4,0,.2,1);
    }
    [data-theme="dark"] {
      --bg-primary:#111110; --bg-secondary:#1a1918; --bg-card:#1e1d1c; --bg-elevated:#252423;
      --text-primary:#ede9e3; --text-secondary:#a8a29e; --text-tertiary:#78716c;
      --accent:#e07a5f; --accent-hover:#e8927a; --accent-light:rgba(224,122,95,.1);
      --border:#2e2c2a; --border-light:#252423;
      --shadow-sm:0 1px 3px rgba(0,0,0,.2); --shadow-md:0 4px 12px rgba(0,0,0,.3);
      --shadow-lg:0 8px 30px rgba(0,0,0,.4); --shadow-xl:0 20px 60px rgba(0,0,0,.5);
    }
    *{margin:0;padding:0;box-sizing:border-box}
    body,html{font-family:var(--font-body);background:var(--bg-primary);color:var(--text-primary);-webkit-font-smoothing:antialiased;line-height:1.6}
    ::selection{background:var(--accent);color:#fff}
    input,textarea,select,button{font-family:inherit;font-size:inherit}
    a{color:inherit;text-decoration:none}
    .container{max-width:var(--max-width);margin:0 auto;padding:0 24px}
    @media(max-width:768px){.container{padding:0 16px} :root{--header-height:60px}}
    @media(max-width:900px){.hide-m{display:none!important} .main-grid{grid-template-columns:1fr!important}}
    ::-webkit-scrollbar{width:8px} ::-webkit-scrollbar-track{background:var(--bg-secondary)} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
    @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeInUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    .anim-in{animation:fadeIn .4s ease-out forwards}
    .anim-up{animation:fadeInUp .5s ease-out forwards}
    .md-h2{font-family:var(--font-display);font-size:1.5rem;font-weight:700;margin:2em 0 .75em;color:var(--text-primary)}
    .md-h3{font-family:var(--font-display);font-size:1.25rem;font-weight:700;margin:1.5em 0 .5em;color:var(--text-primary)}
    .article-body p{margin:1em 0;line-height:1.85;font-size:1.125rem;color:var(--text-secondary)}
    .article-body li{color:var(--text-secondary);font-size:1.125rem;line-height:1.85;margin:.25em 0 .25em 1.5em;list-style:disc}
    .article-body strong{color:var(--text-primary)}
    .rec-card{transition:var(--transition);cursor:pointer}
    .rec-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
    .back-to-top{position:fixed;bottom:32px;right:32px;z-index:100;width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-lg);transition:var(--transition);opacity:0;pointer-events:none;transform:translateY(8px)}
    .back-to-top.visible{opacity:1;pointer-events:auto;transform:translateY(0)}
  `}</style>
);

// ═══════════════════════════════════════════════════════════════
// 8. ARTICLE CARD
// ═══════════════════════════════════════════════════════════════

const ArticleCard = ({ article, variant = "default", index = 0 }) => {
  const { setPage, categories } = useApp();
  const cat = categories?.find(c => c.id === article.category);

  if (variant === "featured") {
    return (
      <article onClick={() => setPage({ name:"article", id:article.id })} className="anim-in"
        style={{ cursor:"pointer", borderRadius:"var(--radius-lg)", overflow:"hidden", background:"var(--bg-card)", border:"1px solid var(--border)", boxShadow:"var(--shadow-md)", transition:"var(--transition)", animationDelay:`${index*.1}s`, animationFillMode:"backwards", display:"grid", gridTemplateColumns:"1fr 1fr" }}
        onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--shadow-lg)";e.currentTarget.style.transform="translateY(-2px)"}}
        onMouseLeave={e=>{e.currentTarget.style.boxShadow="var(--shadow-md)";e.currentTarget.style.transform="none"}}>
        <style>{`@media(max-width:768px){.feat-grid{grid-template-columns:1fr!important}}`}</style>
        <div className="feat-grid" style={{ aspectRatio:"16/10", background:`url(${article.coverImage}) center/cover`, minHeight:240 }}/>
        <div style={{ padding:"32px 28px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
          {cat && <Badge text={`${cat.icon} ${cat.name}`} color={cat.color} />}
          <h2 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"clamp(1.25rem,2vw,1.75rem)", lineHeight:1.3, margin:"12px 0", color:"var(--text-primary)" }}>{article.title}</h2>
          <p style={{ fontSize:15, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:16, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{article.excerpt}</p>
          <div style={{ display:"flex", alignItems:"center", gap:16, fontSize:13, color:"var(--text-tertiary)" }}>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}><I n="clock" s={14}/> {article.readTime} min</span>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}><I n="eye" s={14}/> {article.views?.toLocaleString()}</span>
            <span>{formatDate(article.publishedAt)}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article onClick={() => setPage({ name:"article", id:article.id })} className="anim-in rec-card"
      style={{ borderRadius:"var(--radius-lg)", overflow:"hidden", background:"var(--bg-card)", border:"1px solid var(--border)", boxShadow:"var(--shadow-sm)", animationDelay:`${index*.08}s`, animationFillMode:"backwards" }}>
      {article.coverImage && (
        <div style={{ aspectRatio:"16/9", background:`url(${article.coverImage}) center/cover`, position:"relative" }}>
          {cat && <span style={{ position:"absolute", top:12, left:12, padding:"4px 10px", borderRadius:20, background:"rgba(0,0,0,.6)", backdropFilter:"blur(8px)", color:"#fff", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:".05em" }}>{cat.icon} {cat.name}</span>}
        </div>
      )}
      <div style={{ padding:"20px 20px 18px" }}>
        <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.125rem", lineHeight:1.35, marginBottom:8, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{article.title}</h3>
        <p style={{ fontSize:14, color:"var(--text-secondary)", lineHeight:1.55, marginBottom:14, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{article.excerpt}</p>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:12, color:"var(--text-tertiary)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}><I n="clock" s={13}/> {article.readTime}m</span>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}><I n="heart" s={13}/> {article.likes}</span>
          </div>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
      </div>
    </article>
  );
};

// ═══════════════════════════════════════════════════════════════
// 9. ARTICLE RECOMMENDATION WIDGET
// ═══════════════════════════════════════════════════════════════

const RecommendationWidget = ({ currentArticleId = null }) => {
  const { posts, setPage } = useApp();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 15000); // Show after 15 seconds
    return () => clearTimeout(timer);
  }, []);

  const recommended = useMemo(() => {
    const published = posts.filter(p => p.status === "published" && p.id !== currentArticleId);
    // Sort by a mix of views and recency
    return [...published].sort((a,b) => {
      const scoreA = (a.views||0) * 0.3 + (a.likes||0) * 2 + (new Date(a.publishedAt).getTime() / 1e10);
      const scoreB = (b.views||0) * 0.3 + (b.likes||0) * 2 + (new Date(b.publishedAt).getTime() / 1e10);
      return scoreB - scoreA;
    }).slice(0, 3);
  }, [posts, currentArticleId]);

  if (dismissed || !show || recommended.length === 0) return null;

  return (
    <div style={{ position:"fixed", bottom:24, left:24, zIndex:90, maxWidth:340, background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", boxShadow:"var(--shadow-xl)", animation:"fadeInUp .4s ease-out", overflow:"hidden" }}>
      <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border-light)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <I n="sparkle" s={16} style={{ color:"var(--accent)" }}/>
          <span style={{ fontWeight:600, fontSize:14 }}>Recommended for you</span>
        </div>
        <button onClick={() => setDismissed(true)} style={{ border:"none", background:"none", cursor:"pointer", color:"var(--text-tertiary)", padding:2 }}><I n="x" s={16}/></button>
      </div>
      <div style={{ padding:"12px 16px" }}>
        {recommended.map((a, i) => (
          <div key={a.id} onClick={() => { setPage({ name:"article", id:a.id }); setDismissed(true); }}
            style={{ display:"flex", gap:12, padding:"10px 4px", cursor:"pointer", borderBottom: i < recommended.length-1 ? "1px solid var(--border-light)" : "none" }}>
            {a.coverImage && <div style={{ width:56, height:56, borderRadius:"var(--radius-sm)", flexShrink:0, background:`url(${a.coverImage}) center/cover` }}/>}
            <div>
              <h4 style={{ fontSize:13, fontWeight:600, lineHeight:1.35, marginBottom:3, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{a.title}</h4>
              <span style={{ fontSize:11, color:"var(--text-tertiary)" }}>{a.readTime}m read · {a.views?.toLocaleString()} views</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 10. NEWSLETTER / SUBSCRIPTION (with verification)
// ═══════════════════════════════════════════════════════════════

const NewsletterSection = ({ variant = "default" }) => {
  const { addToast, triggerRefresh } = useApp();
  const [email, setEmail] = useState("");
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [expectedCode, setExpectedCode] = useState("");

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { addToast("Please enter a valid email", "error"); return; }
    const subs = DB.get("subscribers:index") || [];
    const existing = DB.get(`subscriber:${email}`);
    if (existing?.verified) { addToast("You're already subscribed!", "info"); setEmail(""); return; }

    // Generate verification code
    const code = genVerifyCode();
    DB.set(`subscriber:${email}`, { email, subscribedAt: new Date().toISOString(), verified: false, verifyCode: code });
    if (!subs.includes(email)) { subs.push(email); DB.set("subscribers:index", subs); }

    setPendingEmail(email);
    setExpectedCode(code);
    setVerifyMode(true);
    setEmail("");
    addActivity("subscriber_signup", `New subscriber: ${email}`);

    // TODO: In production, send this code via email API (SendGrid, Mailchimp, etc.)
    // Example: await fetch('YOUR_EMAIL_API_ENDPOINT', { method:'POST', body: JSON.stringify({ to: email, code }) })
    addToast(`Verification code: ${code} (in production, this would be emailed)`, "success");
  };

  const handleVerify = () => {
    if (verifyCode.toUpperCase() === expectedCode) {
      const sub = DB.get(`subscriber:${pendingEmail}`);
      if (sub) { sub.verified = true; sub.verifiedAt = new Date().toISOString(); delete sub.verifyCode; DB.set(`subscriber:${pendingEmail}`, sub); }
      addToast("Email verified! Welcome aboard.", "success");
      setVerifyMode(false); setVerifyCode(""); setPendingEmail(""); setExpectedCode("");
      triggerRefresh();
      addActivity("subscriber_verified", `Verified: ${pendingEmail}`);
    } else {
      addToast("Invalid code. Please try again.", "error");
    }
  };

  if (verifyMode) {
    return (
      <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24, textAlign:"center" }}>
        <I n="mail" s={32} style={{ color:"var(--accent)", marginBottom:12 }}/>
        <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.125rem", marginBottom:8 }}>Check your email</h3>
        <p style={{ fontSize:14, color:"var(--text-secondary)", marginBottom:16 }}>We sent a verification code to <strong>{pendingEmail}</strong></p>
        <div style={{ display:"flex", gap:8, maxWidth:300, margin:"0 auto" }}>
          <input value={verifyCode} onChange={e => setVerifyCode(e.target.value)} placeholder="Enter code" maxLength={8}
            style={{ ...inputStyle, textAlign:"center", letterSpacing:4, fontFamily:"var(--font-mono)", fontSize:16, fontWeight:600 }}/>
          <button onClick={handleVerify} style={{ padding:"12px 20px", border:"none", borderRadius:"var(--radius-md)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600, whiteSpace:"nowrap" }}>Verify</button>
        </div>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <form onSubmit={handleSubscribe} style={{ display:"flex", gap:8, maxWidth:400 }}>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="your@email.com" required style={{ ...inputStyle, flex:1, borderRadius:"var(--radius-xl)" }}/>
        <button type="submit" style={{ padding:"10px 20px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>Subscribe</button>
      </form>
    );
  }

  return (
    <section style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"clamp(32px,5vw,56px)", textAlign:"center", margin:"48px 0" }}>
      <div style={{ fontSize:36, marginBottom:12 }}>📬</div>
      <h2 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"clamp(1.5rem,3vw,2rem)", marginBottom:8 }}>Stay in the loop</h2>
      <p style={{ color:"var(--text-secondary)", fontSize:16, maxWidth:480, margin:"0 auto 24px", lineHeight:1.6 }}>Get the latest stories delivered straight to your inbox. No spam, ever.</p>
      <form onSubmit={handleSubscribe} style={{ display:"flex", gap:10, maxWidth:460, margin:"0 auto", flexWrap:"wrap", justifyContent:"center" }}>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Enter your email" required style={{ ...inputStyle, flex:"1 1 240px", borderRadius:"var(--radius-xl)" }}/>
        <button type="submit" style={{ padding:"14px 32px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", fontSize:15, fontWeight:600, cursor:"pointer" }}>Subscribe</button>
      </form>
      <p style={{ fontSize:12, color:"var(--text-tertiary)", marginTop:12 }}>We'll verify your email. Unsubscribe anytime.</p>
    </section>
  );
};

// Due to the massive scope of this application (2000+ lines already), I'll create the
// remaining core pages as a continuation file. Let me output what we have and continue.

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════

const Header = () => {
  const { currentUser, setPage, page, theme, toggleTheme, logout, categories } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [userMenu, setUserMenu] = useState(false);

  const doSearch = (e) => { e.preventDefault(); if (searchQ.trim()) { setPage({ name:"search", query:searchQ.trim() }); setSearchOpen(false); setSearchQ(""); } };
  const dd = { display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 14px", border:"none", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", fontSize:14, fontWeight:500, color:"var(--text-primary)", textAlign:"left" };

  return (
    <>
      <header style={{ position:"sticky", top:0, zIndex:100, height:"var(--header-height)", borderBottom:"1px solid var(--border)", backdropFilter:"blur(20px)", backgroundColor:"color-mix(in srgb, var(--bg-primary) 85%, transparent)" }}>
        <div className="container" style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer" }} onClick={()=>setPage({name:"home"})}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:"var(--font-display)", fontWeight:800, fontSize:18 }}>J</div>
            <div>
              <span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:20, letterSpacing:"-.02em", display:"block", lineHeight:1.1 }}>The Jaaga Desk</span>
              <span className="hide-m" style={{ fontSize:10, color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:".1em" }}>Stories that illuminate</span>
            </div>
          </div>
          <nav style={{ display:"flex", alignItems:"center", gap:8 }}>
            {["Home","Categories","Trending","About"].map(item=>(
              <button key={item} onClick={()=>setPage({name:item.toLowerCase()})} className="hide-m"
                style={{ padding:"8px 14px", border:"none", borderRadius:"var(--radius-sm)", background:page.name===item.toLowerCase()?"var(--accent-light)":"transparent", color:page.name===item.toLowerCase()?"var(--accent)":"var(--text-secondary)", cursor:"pointer", fontSize:14, fontWeight:500 }}>{item}</button>
            ))}
            <div className="hide-m" style={{ width:1, height:24, background:"var(--border)", margin:"0 4px" }}/>
            <button onClick={()=>setSearchOpen(true)} style={{ padding:8, border:"none", background:"none", color:"var(--text-secondary)", cursor:"pointer", display:"flex" }}><I n="search" s={20}/></button>
            <button onClick={toggleTheme} style={{ padding:8, border:"none", background:"none", color:"var(--text-secondary)", cursor:"pointer", display:"flex" }}><I n={theme==="dark"?"sun":"moon"} s={20}/></button>
            {currentUser ? (
              <div style={{ position:"relative" }}>
                <button onClick={()=>setUserMenu(!userMenu)} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 12px", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", background:"var(--bg-card)", cursor:"pointer" }}>
                  <Avatar src={currentUser.avatar} name={currentUser.displayName} size={28} fs={12}/>
                  <span className="hide-m" style={{ fontSize:14, fontWeight:500 }}>{currentUser.displayName}</span>
                  <I n="chevDown" s={14}/>
                </button>
                {userMenu && <>
                  <div style={{ position:"fixed", inset:0, zIndex:50 }} onClick={()=>setUserMenu(false)}/>
                  <div style={{ position:"absolute", right:0, top:"calc(100%+8px)", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", boxShadow:"var(--shadow-lg)", minWidth:200, padding:4, zIndex:51, animation:"slideDown .2s ease-out" }}>
                    {canDo(currentUser.role,"all") && <button onClick={()=>{setPage({name:"admin"});setUserMenu(false)}} style={dd}><I n="dash" s={16}/> Dashboard</button>}
                    {canDo(currentUser.role,"write") && <button onClick={()=>{setPage({name:"write"});setUserMenu(false)}} style={dd}><I n="edit" s={16}/> Write Post</button>}
                    <button onClick={()=>{setPage({name:"profile"});setUserMenu(false)}} style={dd}><I n="user" s={16}/> My Profile</button>
                    <button onClick={()=>{setPage({name:"bookmarks"});setUserMenu(false)}} style={dd}><I n="bookmark" s={16}/> Bookmarks</button>
                    <div style={{ height:1, background:"var(--border)", margin:"4px 0" }}/>
                    <button onClick={()=>{logout();setUserMenu(false)}} style={{ ...dd, color:"#ef4444" }}><I n="logout" s={16}/> Sign Out</button>
                  </div>
                </>}
              </div>
            ) : (
              <button onClick={()=>setPage({name:"login"})} style={{ padding:"8px 20px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}>Sign In</button>
            )}
            <button onClick={()=>setMenuOpen(true)} style={{ padding:8, border:"none", background:"none", color:"var(--text-secondary)", cursor:"pointer", display:"none" }} className="mob-menu"><I n="menu" s={24}/></button>
            <style>{`@media(max-width:600px){.mob-menu{display:flex!important}}`}</style>
          </nav>
        </div>
      </header>
      {searchOpen && <Modal onClose={()=>setSearchOpen(false)} maxWidth={600}>
        <form onSubmit={doSearch} style={{ display:"flex", alignItems:"center", padding:"16px 20px", gap:12 }}>
          <I n="search" s={22}/><input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search articles..." autoFocus style={{ flex:1, border:"none", background:"none", outline:"none", fontSize:17, color:"var(--text-primary)" }}/></form>
      </Modal>}
      {menuOpen && <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,.5)" }} onClick={()=>setMenuOpen(false)}>
        <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", right:0, top:0, bottom:0, width:"min(320px,85vw)", background:"var(--bg-card)", padding:24, animation:"slideIn .3s ease-out", display:"flex", flexDirection:"column", gap:8, overflowY:"auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}><span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:20 }}>Menu</span><button onClick={()=>setMenuOpen(false)} style={{ padding:8, border:"none", background:"none", cursor:"pointer", color:"var(--text-secondary)" }}><I n="close" s={24}/></button></div>
          {["Home","Categories","Trending","About"].map(item=><button key={item} onClick={()=>{setPage({name:item.toLowerCase()});setMenuOpen(false)}} style={{ padding:"14px 16px", border:"none", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", fontSize:16, fontWeight:500, color:"var(--text-primary)", textAlign:"left" }}>{item}</button>)}
          <div style={{ height:1, background:"var(--border)", margin:"8px 0" }}/>
          {categories?.map(c=><button key={c.id} onClick={()=>{setPage({name:"category",id:c.id});setMenuOpen(false)}} style={{ padding:"10px 16px", border:"none", background:"none", cursor:"pointer", fontSize:14, color:"var(--text-secondary)", textAlign:"left" }}>{c.icon} {c.name}</button>)}
        </div>
      </div>}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════

const HomePage = () => {
  const { posts, categories, setPage } = useApp();
  const pub = posts.filter(p => p.status === "published");
  const feat = pub.filter(p => p.featured).slice(0,2);
  const latest = pub.slice(0,9);
  const trending = [...pub].sort((a,b) => (b.views||0) - (a.views||0)).slice(0,5);

  return (
    <div>
      {feat.length > 0 && <section className="container" style={{ paddingTop:40, paddingBottom:32 }}><div style={{ display:"grid", gap:24 }}>{feat.map((a,i) => <ArticleCard key={a.id} article={a} variant="featured" index={i}/>)}</div></section>}
      <section className="container" style={{ paddingBottom:48 }}>
        <div className="main-grid" style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:48 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
              <h2 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.5rem" }}>Latest Stories</h2>
              <div style={{ height:1, flex:1, background:"var(--border)", margin:"0 20px" }}/>
              <span style={{ fontSize:13, color:"var(--text-tertiary)", fontWeight:500 }}>{pub.length} articles</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:24 }}>{latest.map((a,i) => <ArticleCard key={a.id} article={a} index={i}/>)}</div>
          </div>
          <aside>
            <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24, marginBottom:24 }}>
              <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.125rem", marginBottom:8, display:"flex", alignItems:"center", gap:8 }}><I n="trend" s={18}/> Trending Now</h3>
              {trending.map((a,i) => (
                <div key={a.id} onClick={()=>setPage({name:"article",id:a.id})} style={{ cursor:"pointer", display:"flex", gap:12, padding:"12px 0", borderBottom:i<trending.length-1?"1px solid var(--border-light)":"none" }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:24, fontWeight:700, color:"var(--border)", lineHeight:1, minWidth:28 }}>{String(i+1).padStart(2,"0")}</span>
                  <div><h4 style={{ fontSize:14, fontWeight:600, lineHeight:1.35, marginBottom:2 }}>{a.title}</h4><span style={{ fontSize:12, color:"var(--text-tertiary)" }}>{a.readTime}m · {a.views?.toLocaleString()} views</span></div>
                </div>
              ))}
            </div>
            <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24, marginBottom:24 }}>
              <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.125rem", marginBottom:16 }}>Explore Topics</h3>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {categories?.map(c => <button key={c.id} onClick={()=>setPage({name:"category",id:c.id})} style={{ padding:"8px 14px", borderRadius:"var(--radius-xl)", border:"1px solid var(--border)", background:"var(--bg-primary)", cursor:"pointer", fontSize:13, fontWeight:500, color:"var(--text-secondary)", display:"flex", alignItems:"center", gap:6 }}>{c.icon} {c.name}</button>)}
              </div>
            </div>
            <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24 }}>
              <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.125rem", marginBottom:8 }}>Newsletter</h3>
              <p style={{ fontSize:14, color:"var(--text-secondary)", marginBottom:16, lineHeight:1.5 }}>Weekly digest of our best stories.</p>
              <NewsletterSection variant="minimal"/>
            </div>
          </aside>
        </div>
      </section>
      <div className="container"><NewsletterSection/></div>
      <RecommendationWidget/>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ARTICLE PAGE
// ═══════════════════════════════════════════════════════════════

const ArticlePage = ({ articleId }) => {
  const { posts, categories, currentUser, setPage, addToast, triggerRefresh } = useApp();
  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [guestName, setGuestName] = useState("");
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const p = DB.get(`post:${articleId}`);
    if (p) { p.views=(p.views||0)+1; DB.set(`post:${p.id}`,p); setArticle(p);
      const cIdx = DB.get("comments:index")||[];
      setComments(cIdx.map(id=>DB.get(`comment:${id}`)).filter(c=>c&&c.postId===articleId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
      if (currentUser) { setBookmarked((DB.get(`bookmarks:${currentUser.id}`)||[]).includes(articleId)); }
      // Track reading history
      if (currentUser) { const h = DB.get(`history:${currentUser.id}`)||[]; if (!h.includes(articleId)) { h.unshift(articleId); if (h.length>50) h.length=50; DB.set(`history:${currentUser.id}`,h); } }
    }
    window.scrollTo(0,0);
  }, [articleId, currentUser]);

  if (!article) return <div className="container" style={{ padding:"80px 0", textAlign:"center" }}><div style={{ width:"60%", height:40, margin:"0 auto 20px", background:"var(--bg-secondary)", borderRadius:8 }}/></div>;

  const cat = categories?.find(c=>c.id===article.category);
  const related = posts.filter(p=>p.id!==articleId&&p.category===article.category&&p.status==="published").slice(0,3);

  const toggleLike = () => { const n=!liked; setLiked(n); article.likes=(article.likes||0)+(n?1:-1); setArticle({...article}); DB.set(`post:${article.id}`,article); };
  const toggleBookmark = () => {
    if (!currentUser) { addToast("Please sign in to bookmark","info"); return; }
    const bm = DB.get(`bookmarks:${currentUser.id}`)||[];
    if (bookmarked) { bm.splice(bm.indexOf(articleId),1); addToast("Removed from bookmarks","info"); }
    else { bm.push(articleId); addToast("Saved!","success"); }
    DB.set(`bookmarks:${currentUser.id}`,bm); setBookmarked(!bookmarked);
  };
  const postComment = () => {
    if (!commentText.trim()) return;
    if (!currentUser && !guestName.trim()) { addToast("Please enter your name","info"); return; }
    const c = { id:genId(), postId:articleId, author:currentUser?.id||"guest", authorName:currentUser?.displayName||guestName.trim(), content:commentText.trim(), createdAt:new Date().toISOString(), likes:0 };
    DB.set(`comment:${c.id}`,c);
    const idx=DB.get("comments:index")||[]; idx.push(c.id); DB.set("comments:index",idx);
    setComments([c,...comments]); setCommentText(""); addToast("Comment posted!","success");
    addActivity("comment", `${c.authorName} commented on "${article.title}"`);
  };

  return (
    <article className="container" style={{ maxWidth:820, margin:"0 auto", padding:"40px 24px 80px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:24, fontSize:13, color:"var(--text-tertiary)" }}>
        <span style={{ cursor:"pointer" }} onClick={()=>setPage({name:"home"})}>Home</span><I n="chevRight" s={12}/>
        {cat && <><span style={{ cursor:"pointer", color:cat.color }} onClick={()=>setPage({name:"category",id:cat.id})}>{cat.name}</span><I n="chevRight" s={12}/></>}
        <span style={{ color:"var(--text-secondary)" }}>Article</span>
      </div>
      <h1 className="anim-up" style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:"clamp(1.75rem,4vw,2.75rem)", lineHeight:1.2, marginBottom:16, letterSpacing:"-.02em" }}>{article.title}</h1>
      <div className="anim-in" style={{ display:"flex", alignItems:"center", gap:16, marginBottom:32, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Avatar name={article.authorName} size={40} fs={16}/>
          <div><div style={{ fontWeight:600, fontSize:14 }}>{article.authorName}</div><div style={{ fontSize:12, color:"var(--text-tertiary)" }}>{formatDate(article.publishedAt)} · {article.readTime} min read</div></div>
        </div>
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={toggleLike} style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 14px", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", background:liked?"var(--accent-light)":"var(--bg-card)", color:liked?"var(--accent)":"var(--text-secondary)", cursor:"pointer", fontSize:13, fontWeight:500 }}><I n="heart" s={16}/> {article.likes}</button>
          <button onClick={toggleBookmark} style={{ display:"flex", alignItems:"center", gap:4, padding:"8px 12px", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", background:bookmarked?"var(--accent-light)":"var(--bg-card)", color:bookmarked?"var(--accent)":"var(--text-secondary)", cursor:"pointer" }}><I n="bookmark" s={16}/></button>
          <button onClick={()=>{if(navigator.clipboard) navigator.clipboard.writeText(window.location.href); addToast("Link copied!","success")}} style={{ display:"flex", alignItems:"center", gap:4, padding:"8px 12px", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", background:"var(--bg-card)", color:"var(--text-secondary)", cursor:"pointer" }}><I n="share" s={16}/></button>
        </div>
      </div>
      {article.coverImage && <div className="anim-up" style={{ borderRadius:"var(--radius-lg)", overflow:"hidden", marginBottom:40, aspectRatio:"16/8", background:`url(${article.coverImage}) center/cover` }}/>}
      <div className="article-body" style={{ fontFamily:"var(--font-body)", fontSize:"1.125rem", lineHeight:1.85, color:"var(--text-secondary)", marginBottom:48 }} dangerouslySetInnerHTML={{ __html:`<p>${renderMd(article.content)}</p>` }}/>
      {article.tags?.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:48, paddingTop:24, borderTop:"1px solid var(--border)" }}><I n="tag" s={16} style={{ color:"var(--text-tertiary)", marginTop:6 }}/>{article.tags.map(t=><span key={t} onClick={()=>setPage({name:"search",query:t})} style={{ padding:"6px 14px", borderRadius:"var(--radius-xl)", background:"var(--bg-secondary)", fontSize:13, color:"var(--text-secondary)", cursor:"pointer", fontWeight:500 }}>#{t}</span>)}</div>}

      {/* Comments */}
      <section style={{ borderTop:"1px solid var(--border)", paddingTop:40 }}>
        <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.375rem", marginBottom:24 }}>Comments ({comments.length})</h3>
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24, marginBottom:32 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <Avatar src={currentUser?.avatar} name={currentUser?.displayName||"G"} size={36}/>
            {currentUser ? <span style={{ fontWeight:600, fontSize:14 }}>{currentUser.displayName}</span> : <input value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="Your name" style={{ ...inputStyle, maxWidth:200 }}/>}
          </div>
          <textarea value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Share your thoughts..." rows={3} style={{ ...inputStyle, resize:"vertical", lineHeight:1.6, marginBottom:12 }}/>
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button onClick={postComment} disabled={!commentText.trim()} style={{ padding:"10px 24px", border:"none", borderRadius:"var(--radius-xl)", background:commentText.trim()?"var(--accent)":"var(--bg-secondary)", color:commentText.trim()?"#fff":"var(--text-tertiary)", cursor:commentText.trim()?"pointer":"default", fontSize:14, fontWeight:600 }}>Post Comment</button>
          </div>
        </div>
        {comments.length===0 ? <p style={{ textAlign:"center", color:"var(--text-tertiary)", padding:"32px 0" }}>No comments yet. Be the first!</p> :
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>{comments.map((c,i) => (
            <div key={c.id} className="anim-in" style={{ padding:20, background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", animationDelay:`${i*.05}s` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <Avatar name={c.authorName} size={32} fs={12}/><span style={{ fontWeight:600, fontSize:14 }}>{c.authorName}</span>
                {c.author==="guest" && <Badge text="Guest" color="#6b7280"/>}
                <span style={{ fontSize:12, color:"var(--text-tertiary)", marginLeft:"auto" }}>{formatDate(c.createdAt)}</span>
              </div>
              <p style={{ fontSize:14, lineHeight:1.6, color:"var(--text-secondary)" }}>{c.content}</p>
            </div>
          ))}</div>}
      </section>

      {related.length>0 && <section style={{ marginTop:64 }}>
        <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.375rem", marginBottom:24 }}>You might also enjoy</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:20 }}>{related.map((p,i) => <ArticleCard key={p.id} article={p} index={i}/>)}</div>
      </section>}

      <RecommendationWidget currentArticleId={articleId}/>
    </article>
  );
};

// ═══════════════════════════════════════════════════════════════
// WRITE/EDIT PAGE
// ═══════════════════════════════════════════════════════════════

const WritePage = ({ editId = null }) => {
  const { currentUser, setPage, addToast, categories, triggerRefresh } = useApp();
  const [title, setTitle] = useState(""); const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState(""); const [category, setCategory] = useState("");
  const [tags, setTags] = useState(""); const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState("draft"); const [featured, setFeatured] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!currentUser) { setPage({name:"login"}); return; }
    if (!canDo(currentUser.role, "write")) { addToast("You don't have permission to write articles","error"); setPage({name:"home"}); return; }
    if (editId) {
      const p = DB.get(`post:${editId}`);
      if (p) {
        // Check edit permission
        if (p.author !== currentUser.id && !canDo(currentUser.role, "edit_all")) { addToast("You can only edit your own articles","error"); setPage({name:"home"}); return; }
        setTitle(p.title); setContent(p.content); setExcerpt(p.excerpt||""); setCategory(p.category); setTags(p.tags?.join(", ")||""); setCoverUrl(p.coverImage||""); setStatus(p.status); setFeatured(p.featured||false);
      }
    }
  }, [editId, currentUser, setPage, addToast]);

  const handleSave = () => {
    if (!title.trim()||!content.trim()) { addToast("Title and content required","error"); return; }
    const existing = editId ? DB.get(`post:${editId}`) : null;
    const post = {
      id: editId||`post-${genId()}`, title:title.trim(), slug:slugify(title), content:content.trim(),
      excerpt: excerpt.trim()||content.trim().substring(0,150)+"...", category:category||"tech",
      tags: tags.split(",").map(t=>t.trim()).filter(Boolean),
      coverImage: coverUrl||"https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=400&fit=crop",
      author:currentUser.id, authorName:currentUser.displayName, status, featured,
      readTime:readTime(content), views:existing?.views||0, likes:existing?.likes||0,
      createdAt:existing?.createdAt||new Date().toISOString(),
      publishedAt:status==="published"?(existing?.publishedAt||new Date().toISOString()):null,
      updatedAt:new Date().toISOString(),
    };
    DB.set(`post:${post.id}`,post);
    const idx=DB.get("posts:index")||[]; if (!idx.includes(post.id)) { idx.unshift(post.id); DB.set("posts:index",idx); }
    triggerRefresh();
    addActivity(editId?"post_updated":"post_created", `"${post.title}" by ${currentUser.displayName}`);
    addToast(editId?"Article updated!":"Article created!","success");
    setPage({name:"article",id:post.id});
  };

  if (!currentUser||!canDo(currentUser.role,"write")) return null;

  return (
    <div className="container" style={{ maxWidth:860, margin:"0 auto", padding:"32px 24px 80px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32, flexWrap:"wrap", gap:12 }}>
        <h1 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.5rem" }}>{editId?"Edit Article":"Write New Article"}</h1>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={()=>setPreview(!preview)} style={{ padding:"10px 20px", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", background:preview?"var(--accent-light)":"var(--bg-card)", color:preview?"var(--accent)":"var(--text-secondary)", cursor:"pointer", fontSize:14, fontWeight:500 }}>{preview?"Edit":"Preview"}</button>
          <select value={status} onChange={e=>setStatus(e.target.value)} style={{ ...inputStyle, width:"auto", padding:"10px 16px", borderRadius:"var(--radius-xl)" }}>
            <option value="draft">Draft</option>
            {canDo(currentUser.role,"write") && <option value="published">Published</option>}
          </select>
          <button onClick={handleSave} style={{ padding:"10px 24px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}>{editId?"Update":"Publish"}</button>
        </div>
      </div>
      {preview ? (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"40px 32px" }}>
          <h1 style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:"2rem", marginBottom:16 }}>{title||"Untitled"}</h1>
          {coverUrl && <div style={{ borderRadius:"var(--radius-md)", overflow:"hidden", marginBottom:24, aspectRatio:"16/8", background:`url(${coverUrl}) center/cover` }}/>}
          <div className="article-body" dangerouslySetInnerHTML={{ __html:`<p>${renderMd(content)}</p>` }} style={{ fontSize:"1.125rem", lineHeight:1.85, color:"var(--text-secondary)" }}/>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Article title..." style={{ ...inputStyle, fontFamily:"var(--font-display)", fontSize:"1.75rem", fontWeight:700, padding:"16px 20px", border:"none", borderBottom:"2px solid var(--border)" }}/>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Cover Image</label>
            <div style={{ display:"flex", gap:12 }}>
              <input value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="Paste image URL or upload..." style={{ ...inputStyle, flex:1 }}/>
              <input type="file" ref={fileRef} accept="image/*" style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=ev=>setCoverUrl(ev.target.result);r.readAsDataURL(f)}}}/>
              <button onClick={()=>fileRef.current?.click()} style={{ padding:"12px 18px", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", background:"var(--bg-card)", cursor:"pointer", color:"var(--text-secondary)", fontSize:14, display:"flex", alignItems:"center", gap:6 }}><I n="image" s={16}/> Upload</button>
            </div>
            {coverUrl && <div style={{ marginTop:12, borderRadius:"var(--radius-md)", overflow:"hidden", aspectRatio:"16/6", background:`url(${coverUrl}) center/cover`, border:"1px solid var(--border)" }}/>}
          </div>
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Excerpt</label><textarea value={excerpt} onChange={e=>setExcerpt(e.target.value)} placeholder="Brief summary..." rows={2} style={{ ...inputStyle, resize:"vertical", lineHeight:1.6 }}/></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Category</label><select value={category} onChange={e=>setCategory(e.target.value)} style={inputStyle}><option value="">Select...</option>{categories?.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
            <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Tags</label><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="comma, separated" style={inputStyle}/></div>
          </div>
          {canDo(currentUser.role,"all") && <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontSize:14 }}><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)} style={{ width:18, height:18, accentColor:"var(--accent)" }}/><span style={{ fontWeight:500 }}>Feature on homepage</span></label>}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)" }}>Content</label><span style={{ fontSize:12, color:"var(--text-tertiary)" }}>Markdown · {readTime(content)} min · {content.split(/\s+/).filter(Boolean).length} words</span></div>
            <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Write your article... (Markdown supported)" rows={20} style={{ ...inputStyle, fontFamily:"var(--font-mono)", fontSize:14, lineHeight:1.7, resize:"vertical", minHeight:400 }}/>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AUTH PAGE (with email verification & password visibility)
// ═══════════════════════════════════════════════════════════════

const AuthPage = ({ mode = "login" }) => {
  const { login, setPage, addToast } = useApp();
  const [isLogin, setIsLogin] = useState(mode === "login");
  const [form, setForm] = useState({ username:"", email:"", password:"", displayName:"" });
  const [verifyMode, setVerifyMode] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [pendingUser, setPendingUser] = useState(null);
  const [expectedCode, setExpectedCode] = useState("");

  const handleSubmit = () => {
    if (isLogin) {
      const usersIdx = DB.get("users:index")||[];
      let found = null;
      for (const uid of usersIdx) { const u = DB.get(`user:${uid}`); if (u && (u.username===form.username || u.email===form.username) && u.password===form.password) { found=u; break; } }
      if (found) {
        if (!found.verified) { addToast("Please verify your email first","error"); return; }
        found.lastLogin = new Date().toISOString();
        DB.set(`user:${found.id}`, found);
        login(found);
        addActivity("login", `${found.displayName} logged in`);
        addToast(`Welcome back, ${found.displayName}!`,"success");
        // Admin goes to dashboard, others go home
        setPage({ name: found.role === "admin" ? "admin" : "home" });
      } else { addToast("Invalid credentials. Try admin / admin123","error"); }
    } else {
      if (!form.username||!form.email||!form.password||!form.displayName) { addToast("Please fill all fields","error"); return; }
      if (form.password.length < 6) { addToast("Password must be at least 6 characters","error"); return; }
      // Check duplicate
      const usersIdx = DB.get("users:index")||[];
      for (const uid of usersIdx) { const u = DB.get(`user:${uid}`); if (u && (u.username===form.username || u.email===form.email)) { addToast("Username or email already exists","error"); return; } }

      const code = genVerifyCode();
      const newUser = {
        id:`user-${genId()}`, username:form.username, email:form.email, password:form.password,
        displayName:form.displayName, role:"reader", // NEW USERS ARE READERS BY DEFAULT
        avatar:null, bio:"", joinedAt:new Date().toISOString(), verified:false, verifyCode:code, lastLogin:null,
      };
      DB.set(`user:${newUser.id}`, newUser);
      const idx = DB.get("users:index")||[]; idx.push(newUser.id); DB.set("users:index", idx);
      setPendingUser(newUser);
      setExpectedCode(code);
      setVerifyMode(true);
      addActivity("user_signup", `New user: ${newUser.displayName} (${newUser.email})`);

      // TODO: Send verification email via API
      // await fetch('YOUR_EMAIL_API', { method:'POST', body: JSON.stringify({ to: newUser.email, subject: 'Verify your Jaaga Desk account', body: `Your code: ${code}` }) })
      addToast(`Verification code: ${code} (would be emailed in production)`,"success");
    }
  };

  const handleVerify = () => {
    if (verifyCode.toUpperCase() === expectedCode && pendingUser) {
      pendingUser.verified = true;
      pendingUser.verifiedAt = new Date().toISOString();
      delete pendingUser.verifyCode;
      pendingUser.lastLogin = new Date().toISOString();
      DB.set(`user:${pendingUser.id}`, pendingUser);
      login(pendingUser);
      addToast("Email verified! Welcome to The Jaaga Desk.","success");
      setPage({name:"home"});
    } else {
      addToast("Invalid code","error");
    }
  };

  if (verifyMode) {
    return (
      <div style={{ minHeight:"calc(100vh - var(--header-height))", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div className="anim-up" style={{ maxWidth:420, width:"100%", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"40px 32px", boxShadow:"var(--shadow-lg)", textAlign:"center" }}>
          <I n="mail" s={48} style={{ color:"var(--accent)", marginBottom:16 }}/>
          <h2 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.5rem", marginBottom:8 }}>Verify Your Email</h2>
          <p style={{ color:"var(--text-secondary)", fontSize:14, marginBottom:24 }}>We sent a verification code to <strong>{pendingUser?.email}</strong></p>
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            <input value={verifyCode} onChange={e=>setVerifyCode(e.target.value)} placeholder="Enter code" maxLength={8} style={{ ...inputStyle, textAlign:"center", letterSpacing:4, fontFamily:"var(--font-mono)", fontSize:18, fontWeight:600 }}/>
          </div>
          <button onClick={handleVerify} style={{ width:"100%", padding:"14px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", fontSize:15, fontWeight:600, cursor:"pointer" }}>Verify & Continue</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"calc(100vh - var(--header-height))", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="anim-up" style={{ maxWidth:420, width:"100%", background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"40px 32px", boxShadow:"var(--shadow-lg)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", color:"#fff", fontFamily:"var(--font-display)", fontWeight:800, fontSize:24 }}>J</div>
          <h2 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.5rem", marginBottom:4 }}>{isLogin?"Welcome back":"Join The Jaaga Desk"}</h2>
          <p style={{ color:"var(--text-tertiary)", fontSize:14 }}>{isLogin?"Sign in to your account":"Create your free account"}</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {!isLogin && <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Display Name</label><input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} placeholder="John Doe" style={inputStyle}/></div>}
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>{isLogin?"Username or Email":"Username"}</label><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder={isLogin?"admin":"johndoe"} style={inputStyle}/></div>
          {!isLogin && <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" placeholder="john@example.com" style={inputStyle}/></div>}
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Password</label><PasswordInput value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder={isLogin?"admin123":"Min 6 characters"} style={inputStyle}/></div>
          <button onClick={handleSubmit} style={{ width:"100%", padding:"14px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", fontSize:15, fontWeight:600, cursor:"pointer", marginTop:8 }}>{isLogin?"Sign In":"Create Account"}</button>
        </div>
        <p style={{ textAlign:"center", marginTop:20, fontSize:14, color:"var(--text-tertiary)" }}>{isLogin?"Don't have an account? ":"Already have an account? "}<span onClick={()=>setIsLogin(!isLogin)} style={{ color:"var(--accent)", cursor:"pointer", fontWeight:600 }}>{isLogin?"Sign Up":"Sign In"}</span></p>
        {isLogin && <p style={{ textAlign:"center", marginTop:12, fontSize:12, color:"var(--text-tertiary)", padding:12, background:"var(--bg-secondary)", borderRadius:"var(--radius-sm)" }}>Demo: <strong>admin</strong> / <strong>admin123</strong></p>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PROFILE PAGE (with avatar, email, password)
// ═══════════════════════════════════════════════════════════════

const ProfilePage = () => {
  const { currentUser, setCurrentUser, addToast } = useApp();
  const [bio, setBio] = useState(currentUser?.bio||"");
  const [displayName, setDisplayName] = useState(currentUser?.displayName||"");
  const [email, setEmail] = useState(currentUser?.email||"");
  const [curPw, setCurPw] = useState(""); const [newPw, setNewPw] = useState(""); const [confirmPw, setConfirmPw] = useState("");
  const avatarRef = useRef(null);

  if (!currentUser) return null;

  const saveProfile = () => { const u={...currentUser,bio,displayName,email}; DB.set(`user:${currentUser.id}`,u); setCurrentUser(u); addToast("Profile updated!","success"); };
  const changePw = () => {
    if (curPw!==currentUser.password) { addToast("Current password is incorrect","error"); return; }
    if (newPw.length<6) { addToast("New password must be at least 6 characters","error"); return; }
    if (newPw!==confirmPw) { addToast("Passwords don't match","error"); return; }
    const u={...currentUser,password:newPw}; DB.set(`user:${currentUser.id}`,u); setCurrentUser(u);
    setCurPw(""); setNewPw(""); setConfirmPw("");
    addToast("Password changed!","success");
  };
  const uploadAvatar = (e) => { const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ const u={...currentUser,avatar:ev.target.result}; DB.set(`user:${currentUser.id}`,u); setCurrentUser(u); addToast("Avatar updated!","success"); }; r.readAsDataURL(f); };

  return (
    <div className="container" style={{ padding:"40px 24px 80px", maxWidth:600, margin:"0 auto" }}>
      <h1 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.5rem", marginBottom:32 }}>My Profile</h1>
      <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:32, marginBottom:24 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ position:"relative", display:"inline-block" }}>
            <Avatar src={currentUser.avatar} name={displayName} size={80} fs={32}/>
            <button onClick={()=>avatarRef.current?.click()} style={{ position:"absolute", bottom:-4, right:-4, width:32, height:32, borderRadius:"50%", background:"var(--accent)", color:"#fff", border:"3px solid var(--bg-card)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><I n="camera" s={14}/></button>
            <input type="file" ref={avatarRef} accept="image/*" style={{ display:"none" }} onChange={uploadAvatar}/>
          </div>
          <p style={{ color:"var(--text-tertiary)", fontSize:13, marginTop:12 }}>
            Member since {formatDate(currentUser.joinedAt)} · <Badge text={ROLES[currentUser.role]?.label||currentUser.role} color={ROLES[currentUser.role]?.color||"#6b7280"}/>
          </p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Display Name</label><input value={displayName} onChange={e=>setDisplayName(e.target.value)} style={inputStyle}/></div>
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} type="email" style={inputStyle}/></div>
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Bio</label><textarea value={bio} onChange={e=>setBio(e.target.value)} rows={4} placeholder="About you..." style={{ ...inputStyle, resize:"vertical", lineHeight:1.6 }}/></div>
          <button onClick={saveProfile} style={{ padding:"12px 24px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600, alignSelf:"flex-end" }}>Save Changes</button>
        </div>
      </div>
      <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:32 }}>
        <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.125rem", marginBottom:20, display:"flex", alignItems:"center", gap:8 }}><I n="lock" s={18}/> Change Password</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Current Password</label><PasswordInput value={curPw} onChange={e=>setCurPw(e.target.value)} placeholder="Current password" style={inputStyle}/></div>
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>New Password</label><PasswordInput value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="Min 6 characters" style={inputStyle}/></div>
          <div><label style={{ fontSize:13, fontWeight:600, color:"var(--text-secondary)", marginBottom:6, display:"block" }}>Confirm New Password</label><PasswordInput value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} placeholder="Confirm" style={inputStyle}/></div>
          <button onClick={changePw} style={{ padding:"12px 24px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600, alignSelf:"flex-end" }}>Update Password</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD (comprehensive)
// ═══════════════════════════════════════════════════════════════

const AdminDashboard = () => {
  const { posts, currentUser, setPage, addToast, triggerRefresh, categories } = useApp();
  const [tab, setTab] = useState("overview");
  const [deleteId, setDeleteId] = useState(null);
  const [roleModal, setRoleModal] = useState(null); // { userId, currentRole }
  const [selectedRole, setSelectedRole] = useState("");

  const allUsers = useMemo(() => {
    const idx = DB.get("users:index")||[];
    return idx.map(id=>DB.get(`user:${id}`)).filter(Boolean);
  }, [posts]);

  const subscribers = useMemo(() => {
    const idx = DB.get("subscribers:index")||[];
    return idx.map(e=>DB.get(`subscriber:${e}`)).filter(Boolean);
  }, [posts]);

  const comments = useMemo(() => {
    const idx = DB.get("comments:index")||[];
    return idx.map(id=>DB.get(`comment:${id}`)).filter(Boolean).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  }, [posts]);

  const activity = useMemo(() => DB.get("activity:log")||[], [posts]);

  if (!currentUser||currentUser.role!=="admin") return <div className="container" style={{ padding:"80px 0", textAlign:"center" }}><h2>Access Denied</h2></div>;

  const pub = posts.filter(p=>p.status==="published");
  const totalViews = posts.reduce((s,p)=>s+(p.views||0),0);
  const totalLikes = posts.reduce((s,p)=>s+(p.likes||0),0);
  const verifiedSubs = subscribers.filter(s=>s.verified).length;
  const dbSize = (DB.getSize()/1024).toFixed(1);

  const handleDelete = (id) => { DB.delete(`post:${id}`); const idx=DB.get("posts:index")||[]; DB.set("posts:index",idx.filter(i=>i!==id)); triggerRefresh(); addToast("Deleted","info"); setDeleteId(null); addActivity("post_deleted",`Article deleted`); };
  const handleDeleteComment = (cid) => { DB.delete(`comment:${cid}`); const idx=DB.get("comments:index")||[]; DB.set("comments:index",idx.filter(i=>i!==cid)); triggerRefresh(); addToast("Comment removed","info"); };
  const handleChangeRole = () => {
    if (!roleModal||!selectedRole) return;
    const u = DB.get(`user:${roleModal.userId}`);
    if (u) { u.role = selectedRole; DB.set(`user:${u.id}`,u); triggerRefresh(); addToast(`Role updated to ${ROLES[selectedRole]?.label}`,"success"); addActivity("role_change",`${u.displayName} → ${selectedRole}`); }
    setRoleModal(null); setSelectedRole("");
  };
  const handleRemoveSubscriber = (email) => {
    DB.delete(`subscriber:${email}`);
    const idx = DB.get("subscribers:index")||[];
    DB.set("subscribers:index", idx.filter(e=>e!==email));
    triggerRefresh();
    addToast("Subscriber removed","info");
  };

  const stats = [
    { label:"Articles", value:posts.length, icon:"edit", color:"var(--accent)" },
    { label:"Published", value:pub.length, icon:"globe", color:"var(--accent-secondary)" },
    { label:"Views", value:totalViews.toLocaleString(), icon:"eye", color:"#8b5cf6" },
    { label:"Likes", value:totalLikes.toLocaleString(), icon:"heart", color:"#ef4444" },
    { label:"Users", value:allUsers.length, icon:"users", color:"#06b6d4" },
    { label:"Subscribers", value:`${verifiedSubs}/${subscribers.length}`, icon:"mail", color:"#f59e0b" },
    { label:"Comments", value:comments.length, icon:"comment", color:"#10b981" },
    { label:"DB Size", value:`${dbSize} KB`, icon:"database", color:"#6366f1" },
  ];

  const tabBtn = (t) => ({ padding:"10px 18px", border:"none", borderRadius:"var(--radius-xl)", background:tab===t?"var(--accent)":"var(--bg-secondary)", color:tab===t?"#fff":"var(--text-secondary)", cursor:"pointer", fontSize:14, fontWeight:500 });

  return (
    <div className="container" style={{ padding:"32px 24px 80px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32, flexWrap:"wrap", gap:12 }}>
        <h1 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.75rem" }}><I n="dash" s={24} style={{ verticalAlign:"middle", marginRight:8 }}/> Dashboard</h1>
        <button onClick={()=>setPage({name:"write"})} style={{ padding:"10px 24px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}><I n="plus" s={16}/> New Article</button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:32 }}>
        {stats.map((s,i)=>(
          <div key={s.label} className="anim-in" style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:"16px 18px", animationDelay:`${i*.04}s`, animationFillMode:"backwards" }}>
            <div style={{ width:28, height:28, borderRadius:"var(--radius-sm)", background:s.color+"15", color:s.color, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:6 }}><I n={s.icon} s={14}/></div>
            <div style={{ fontSize:"1.25rem", fontWeight:700, fontFamily:"var(--font-display)" }}>{s.value}</div>
            <div style={{ fontSize:12, color:"var(--text-tertiary)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24, flexWrap:"wrap", overflowX:"auto" }}>
        {["overview","articles","users","comments","subscribers","activity","database"].map(t=><button key={t} onClick={()=>setTab(t)} style={tabBtn(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>

      {/* Overview */}
      {tab==="overview" && (
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:24 }} className="main-grid">
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24 }}>
            <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, marginBottom:16 }}>Recent Articles</h3>
            {posts.slice(0,8).map((p,i) => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0", borderBottom:i<7?"1px solid var(--border-light)":"none", gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:600, fontSize:14, marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</div><div style={{ fontSize:12, color:"var(--text-tertiary)" }}>{p.views} views · {formatDate(p.createdAt)}</div></div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <Badge text={p.status} color={p.status==="published"?"#10b981":"#f59e0b"}/>
                  <button onClick={()=>setPage({name:"edit",id:p.id})} style={{ padding:"5px 8px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", color:"var(--accent)" }}><I n="edit" s={14}/></button>
                  <button onClick={()=>setDeleteId(p.id)} style={{ padding:"5px 8px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", color:"#ef4444" }}><I n="trash" s={14}/></button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24, marginBottom:16 }}>
              <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, marginBottom:12 }}>Recent Activity</h3>
              {activity.slice(0,10).map((a,i) => (
                <div key={i} style={{ padding:"8px 0", borderBottom:i<9?"1px solid var(--border-light)":"none", fontSize:13 }}>
                  <div style={{ color:"var(--text-secondary)" }}>{a.details}</div>
                  <div style={{ fontSize:11, color:"var(--text-tertiary)" }}>{formatDate(a.timestamp)}</div>
                </div>
              ))}
              {activity.length===0 && <p style={{ color:"var(--text-tertiary)", fontSize:14 }}>No activity yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Articles */}
      {tab==="articles" && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead><tr style={{ borderBottom:"1px solid var(--border)" }}>{["Title","Category","Status","Views","Likes","Date","Actions"].map(h=><th key={h} style={{ padding:"14px 16px", textAlign:"left", fontWeight:600, color:"var(--text-tertiary)", fontSize:12, textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{posts.map(p=>{ const cat=categories?.find(c=>c.id===p.category); return (
                <tr key={p.id} style={{ borderBottom:"1px solid var(--border-light)" }}>
                  <td style={{ padding:"12px 16px", fontWeight:500, maxWidth:250, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</td>
                  <td style={{ padding:"12px 16px", color:"var(--text-secondary)" }}>{cat?`${cat.icon} ${cat.name}`:"-"}</td>
                  <td style={{ padding:"12px 16px" }}><Badge text={p.status} color={p.status==="published"?"#10b981":"#f59e0b"}/></td>
                  <td style={{ padding:"12px 16px", color:"var(--text-secondary)" }}>{p.views?.toLocaleString()}</td>
                  <td style={{ padding:"12px 16px", color:"var(--text-secondary)" }}>{p.likes}</td>
                  <td style={{ padding:"12px 16px", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{formatDate(p.createdAt)}</td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>setPage({name:"article",id:p.id})} title="View" style={{ padding:"5px 8px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", color:"var(--text-secondary)" }}><I n="eye" s={14}/></button>
                      <button onClick={()=>setPage({name:"edit",id:p.id})} title="Edit" style={{ padding:"5px 8px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", color:"var(--accent)" }}><I n="edit" s={14}/></button>
                      <button onClick={()=>setDeleteId(p.id)} title="Delete" style={{ padding:"5px 8px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", color:"#ef4444" }}><I n="trash" s={14}/></button>
                    </div>
                  </td>
                </tr>
              );})}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users (admin can manage roles) */}
      {tab==="users" && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead><tr style={{ borderBottom:"1px solid var(--border)" }}>{["User","Email","Role","Verified","Joined","Last Login","Actions"].map(h=><th key={h} style={{ padding:"14px 16px", textAlign:"left", fontWeight:600, color:"var(--text-tertiary)", fontSize:12, textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{allUsers.map(u=>(
                <tr key={u.id} style={{ borderBottom:"1px solid var(--border-light)" }}>
                  <td style={{ padding:"12px 16px" }}><div style={{ display:"flex", alignItems:"center", gap:10 }}><Avatar src={u.avatar} name={u.displayName} size={28} fs={11}/><div><div style={{ fontWeight:600 }}>{u.displayName}</div><div style={{ fontSize:12, color:"var(--text-tertiary)" }}>@{u.username}</div></div></div></td>
                  <td style={{ padding:"12px 16px", color:"var(--text-secondary)" }}>{u.email}</td>
                  <td style={{ padding:"12px 16px" }}><Badge text={ROLES[u.role]?.label||u.role} color={ROLES[u.role]?.color||"#6b7280"}/></td>
                  <td style={{ padding:"12px 16px" }}>{u.verified ? <span style={{ color:"#10b981" }}>✓ Yes</span> : <span style={{ color:"#ef4444" }}>✕ No</span>}</td>
                  <td style={{ padding:"12px 16px", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{formatDate(u.joinedAt)}</td>
                  <td style={{ padding:"12px 16px", color:"var(--text-tertiary)", whiteSpace:"nowrap" }}>{u.lastLogin ? formatDate(u.lastLogin) : "Never"}</td>
                  <td style={{ padding:"12px 16px" }}>
                    {u.id !== "admin" && <button onClick={()=>{setRoleModal({userId:u.id,currentRole:u.role}); setSelectedRole(u.role)}} style={{ padding:"5px 12px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", fontSize:12, fontWeight:500, color:"var(--accent)" }}>Change Role</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comments */}
      {tab==="comments" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {comments.length===0 ? <p style={{ textAlign:"center", padding:40, color:"var(--text-tertiary)" }}>No comments yet.</p> : comments.map(c=>(
            <div key={c.id} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", padding:16, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
              <div><div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{c.authorName} {c.author==="guest"&&<Badge text="Guest" color="#6b7280"/>} <span style={{ color:"var(--text-tertiary)", fontWeight:400, marginLeft:8, fontSize:12 }}>{formatDate(c.createdAt)}</span></div><p style={{ fontSize:14, color:"var(--text-secondary)", marginBottom:6 }}>{c.content}</p><span onClick={()=>setPage({name:"article",id:c.postId})} style={{ fontSize:12, color:"var(--accent)", cursor:"pointer" }}>View Article →</span></div>
              <button onClick={()=>handleDeleteComment(c.id)} style={{ padding:6, border:"none", background:"none", cursor:"pointer", color:"#ef4444", flexShrink:0 }}><I n="trash" s={16}/></button>
            </div>
          ))}
        </div>
      )}

      {/* Subscribers */}
      {tab==="subscribers" && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
          {subscribers.length===0 ? <p style={{ textAlign:"center", padding:40, color:"var(--text-tertiary)" }}>No subscribers yet.</p> : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
              <thead><tr style={{ borderBottom:"1px solid var(--border)" }}>{["Email","Status","Subscribed","Verified At","Actions"].map(h=><th key={h} style={{ padding:"14px 16px", textAlign:"left", fontWeight:600, color:"var(--text-tertiary)", fontSize:12, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
              <tbody>{subscribers.map(s=>(
                <tr key={s.email} style={{ borderBottom:"1px solid var(--border-light)" }}>
                  <td style={{ padding:"12px 16px" }}>{s.email}</td>
                  <td style={{ padding:"12px 16px" }}><Badge text={s.verified?"Verified":"Pending"} color={s.verified?"#10b981":"#f59e0b"}/></td>
                  <td style={{ padding:"12px 16px", color:"var(--text-tertiary)" }}>{formatDate(s.subscribedAt)}</td>
                  <td style={{ padding:"12px 16px", color:"var(--text-tertiary)" }}>{s.verifiedAt ? formatDate(s.verifiedAt) : "—"}</td>
                  <td style={{ padding:"12px 16px" }}><button onClick={()=>handleRemoveSubscriber(s.email)} style={{ padding:"5px 8px", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", background:"none", cursor:"pointer", color:"#ef4444" }}><I n="trash" s={14}/></button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {/* Activity Log */}
      {tab==="activity" && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, marginBottom:16 }}>Activity Log ({activity.length} entries)</h3>
          {activity.length===0 ? <p style={{ color:"var(--text-tertiary)" }}>No activity recorded yet.</p> : activity.slice(0,50).map((a,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:i<49?"1px solid var(--border-light)":"none", fontSize:14 }}>
              <div><Badge text={a.action} color="#6366f1"/> <span style={{ color:"var(--text-secondary)", marginLeft:8 }}>{a.details}</span></div>
              <span style={{ fontSize:12, color:"var(--text-tertiary)", whiteSpace:"nowrap", marginLeft:16 }}>{formatDate(a.timestamp)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Database */}
      {tab==="database" && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:24 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700 }}><I n="database" s={20} style={{ verticalAlign:"middle", marginRight:8 }}/> Database Inspector</h3>
            <span style={{ fontSize:13, color:"var(--text-tertiary)" }}>{DB.getAllKeys().length} keys · {dbSize} KB</span>
          </div>
          <div style={{ maxHeight:400, overflowY:"auto", fontFamily:"var(--font-mono)", fontSize:12 }}>
            {DB.getAllKeys().sort().map(key => {
              const val = DB.get(key);
              const preview = typeof val === "object" ? (Array.isArray(val) ? `[${val.length} items]` : JSON.stringify(val).substring(0,80)+"...") : String(val);
              return (
                <div key={key} style={{ padding:"8px 12px", borderBottom:"1px solid var(--border-light)", display:"flex", gap:12 }}>
                  <span style={{ color:"var(--accent)", fontWeight:600, minWidth:200, flexShrink:0 }}>{key}</span>
                  <span style={{ color:"var(--text-tertiary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{preview}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && <Modal onClose={()=>setDeleteId(null)}>
        <div style={{ padding:32 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.25rem", marginBottom:12 }}>Delete Article?</h3>
          <p style={{ color:"var(--text-secondary)", fontSize:14, marginBottom:24, lineHeight:1.6 }}>This action cannot be undone.</p>
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button onClick={()=>setDeleteId(null)} style={{ padding:"10px 20px", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", background:"var(--bg-card)", cursor:"pointer", fontSize:14, fontWeight:500, color:"var(--text-secondary)" }}>Cancel</button>
            <button onClick={()=>handleDelete(deleteId)} style={{ padding:"10px 20px", border:"none", borderRadius:"var(--radius-xl)", background:"#ef4444", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}>Delete</button>
          </div>
        </div>
      </Modal>}

      {/* Role Change Modal */}
      {roleModal && <Modal onClose={()=>setRoleModal(null)}>
        <div style={{ padding:32 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.25rem", marginBottom:16 }}>Change User Role</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
            {Object.entries(ROLES).map(([key, val]) => (
              <label key={key} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", border:`2px solid ${selectedRole===key?"var(--accent)":"var(--border)"}`, borderRadius:"var(--radius-md)", cursor:"pointer", transition:"var(--transition)" }}>
                <input type="radio" name="role" value={key} checked={selectedRole===key} onChange={()=>setSelectedRole(key)} style={{ accentColor:"var(--accent)" }}/>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}><Badge text={val.label} color={val.color}/></div>
                  <div style={{ fontSize:12, color:"var(--text-tertiary)", marginTop:2 }}>Level {val.level} · {val.permissions.join(", ")}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button onClick={()=>setRoleModal(null)} style={{ padding:"10px 20px", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", background:"var(--bg-card)", cursor:"pointer", fontSize:14, color:"var(--text-secondary)" }}>Cancel</button>
            <button onClick={handleChangeRole} style={{ padding:"10px 20px", border:"none", borderRadius:"var(--radius-xl)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}>Save Role</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SECONDARY PAGES
// ═══════════════════════════════════════════════════════════════

const CategoriesPage = () => {
  const { categories, posts, setPage } = useApp();
  return <div className="container" style={{ padding:"40px 24px 80px" }}>
    <h1 className="anim-up" style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"clamp(1.75rem,3vw,2.5rem)", marginBottom:32, textAlign:"center" }}>Explore Topics</h1>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:20, maxWidth:900, margin:"0 auto" }}>
      {categories?.map((c,i)=>{ const cnt=posts.filter(p=>p.category===c.id&&p.status==="published").length; return (
        <div key={c.id} className="anim-in rec-card" onClick={()=>setPage({name:"category",id:c.id})}
          style={{ padding:28, background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", cursor:"pointer", animationDelay:`${i*.05}s`, animationFillMode:"backwards", borderLeft:`4px solid ${c.color}` }}>
          <span style={{ fontSize:32, marginBottom:12, display:"block" }}>{c.icon}</span>
          <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.25rem", marginBottom:4 }}>{c.name}</h3>
          <p style={{ fontSize:13, color:"var(--text-tertiary)", marginBottom:4 }}>{c.description}</p>
          <p style={{ fontSize:14, color:"var(--text-tertiary)" }}>{cnt} article{cnt!==1?"s":""}</p>
        </div>
      );})}
    </div>
  </div>;
};

const CategoryPage = ({ categoryId }) => {
  const { categories, posts, setPage } = useApp();
  const cat = categories?.find(c=>c.id===categoryId);
  const cp = posts.filter(p=>p.category===categoryId&&p.status==="published");
  return <div className="container" style={{ padding:"40px 24px 80px" }}>
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:24, fontSize:13, color:"var(--text-tertiary)" }}><span style={{ cursor:"pointer" }} onClick={()=>setPage({name:"home"})}>Home</span><I n="chevRight" s={12}/><span style={{ cursor:"pointer" }} onClick={()=>setPage({name:"categories"})}>Categories</span><I n="chevRight" s={12}/><span style={{ color:cat?.color }}>{cat?.name}</span></div>
    <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:32 }}><span style={{ fontSize:48 }}>{cat?.icon}</span><div><h1 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"2rem" }}>{cat?.name}</h1><p style={{ color:"var(--text-tertiary)", fontSize:14 }}>{cp.length} articles</p></div></div>
    {cp.length===0 ? <p style={{ textAlign:"center", padding:60, color:"var(--text-tertiary)" }}>No articles yet.</p> : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:24 }}>{cp.map((p,i)=><ArticleCard key={p.id} article={p} index={i}/>)}</div>}
  </div>;
};

const TrendingPage = () => {
  const { posts } = useApp();
  const t = [...posts].filter(p=>p.status==="published").sort((a,b)=>(b.views||0)-(a.views||0));
  return <div className="container" style={{ padding:"40px 24px 80px", maxWidth:900, margin:"0 auto" }}>
    <div style={{ textAlign:"center", marginBottom:40 }}><h1 className="anim-up" style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"clamp(1.75rem,3vw,2.5rem)", display:"flex", alignItems:"center", justifyContent:"center", gap:12 }}><I n="fire" s={32}/> Trending</h1></div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:24 }}>{t.map((p,i)=><ArticleCard key={p.id} article={p} index={i}/>)}</div>
  </div>;
};

const SearchPage = ({ query }) => {
  const { posts } = useApp();
  const q = query.toLowerCase();
  const r = posts.filter(p=>p.status==="published"&&(p.title.toLowerCase().includes(q)||p.content?.toLowerCase().includes(q)||p.tags?.some(t=>t.toLowerCase().includes(q))||p.excerpt?.toLowerCase().includes(q)));
  return <div className="container" style={{ padding:"40px 24px 80px", maxWidth:900, margin:"0 auto" }}>
    <div style={{ marginBottom:32 }}><p style={{ fontSize:14, color:"var(--text-tertiary)", marginBottom:4 }}>Results for</p><h1 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.75rem" }}>"{query}"</h1><p style={{ color:"var(--text-tertiary)", fontSize:14, marginTop:4 }}>{r.length} result{r.length!==1?"s":""}</p></div>
    {r.length===0 ? <div style={{ textAlign:"center", padding:60 }}><p style={{ fontSize:48, marginBottom:16 }}>🔍</p><p style={{ color:"var(--text-tertiary)" }}>No articles found.</p></div> : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:24 }}>{r.map((p,i)=><ArticleCard key={p.id} article={p} index={i}/>)}</div>}
  </div>;
};

const BookmarksPage = () => {
  const { currentUser, posts } = useApp();
  const bm = useMemo(() => { if(!currentUser) return []; return (DB.get(`bookmarks:${currentUser.id}`)||[]).map(id=>DB.get(`post:${id}`)).filter(Boolean); }, [currentUser, posts]);
  if (!currentUser) return <div className="container" style={{ padding:"80px 0", textAlign:"center" }}><p>Please sign in.</p></div>;
  return <div className="container" style={{ padding:"40px 24px 80px", maxWidth:900, margin:"0 auto" }}>
    <h1 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.75rem", marginBottom:32 }}><I n="bookmark" s={24} style={{ verticalAlign:"middle", marginRight:8 }}/> Bookmarks</h1>
    {bm.length===0 ? <div style={{ textAlign:"center", padding:60 }}><p style={{ fontSize:48, marginBottom:16 }}>📑</p><p style={{ color:"var(--text-tertiary)" }}>No bookmarks yet.</p></div> : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:24 }}>{bm.map((p,i)=><ArticleCard key={p.id} article={p} index={i}/>)}</div>}
  </div>;
};

const AboutPage = () => (
  <div className="container" style={{ maxWidth:720, margin:"0 auto", padding:"48px 24px 80px" }}>
    <div className="anim-up">
      <h1 style={{ fontFamily:"var(--font-display)", fontWeight:800, fontSize:"clamp(2rem,4vw,3rem)", marginBottom:24, lineHeight:1.2, textAlign:"center" }}>About The Jaaga Desk</h1>
      <div style={{ width:60, height:4, borderRadius:2, background:"var(--accent)", margin:"0 auto 40px" }}/>
      <div style={{ fontSize:"1.125rem", lineHeight:1.85, color:"var(--text-secondary)" }}>
        <p style={{ marginBottom:20 }}>The Jaaga Desk is a digital publication rooted in Northern Ghanaian heritage, dedicated to delivering thoughtful stories that inform, inspire, and illuminate.</p>
        <p style={{ marginBottom:20 }}>"Jaaga" carries the meaning of "a place" and "to be awake" — this space is both a gathering point and a call to consciousness. Every article is crafted with care and intentionality.</p>
        <p style={{ marginBottom:32 }}>From technology to culture, science to food, travel to opinion — we explore the ideas that shape our world, always with depth and a distinctive perspective.</p>
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:32 }}>
          <h3 style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"1.25rem", marginBottom:16 }}>Contact</h3>
          <p style={{ fontSize:14, color:"var(--text-secondary)" }}>Email: <a href="mailto:hello@idrisjaaga.com" style={{ color:"var(--accent)" }}>hello@idrisjaaga.com</a></p>
          <p style={{ fontSize:14, color:"var(--text-secondary)", marginTop:4 }}>Website: <a href="https://idrisjaaga.com" style={{ color:"var(--accent)" }}>idrisjaaga.com</a></p>
        </div>
      </div>
    </div>
    <NewsletterSection/>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════

const Footer = () => {
  const { setPage, categories } = useApp();
  return (
    <footer style={{ borderTop:"1px solid var(--border)", background:"var(--bg-secondary)", padding:"48px 0 24px" }}>
      <div className="container">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:32, marginBottom:40 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}><div style={{ width:32, height:32, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:"var(--font-display)", fontWeight:800, fontSize:16 }}>J</div><span style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:18 }}>The Jaaga Desk</span></div>
            <p style={{ fontSize:14, color:"var(--text-tertiary)", lineHeight:1.6, maxWidth:260 }}>Stories that illuminate — rooted in Northern Ghanaian heritage, reaching across the world.</p>
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:14, marginBottom:16, textTransform:"uppercase", letterSpacing:".05em", color:"var(--text-tertiary)" }}>Quick Links</h4>
            {["Home","About","Trending","Categories"].map(item=><div key={item} onClick={()=>setPage({name:item.toLowerCase()})} style={{ cursor:"pointer", color:"var(--text-secondary)", fontSize:14, padding:"6px 0" }}>{item}</div>)}
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:14, marginBottom:16, textTransform:"uppercase", letterSpacing:".05em", color:"var(--text-tertiary)" }}>Topics</h4>
            {categories?.slice(0,6).map(c=><div key={c.id} onClick={()=>setPage({name:"category",id:c.id})} style={{ cursor:"pointer", color:"var(--text-secondary)", fontSize:14, padding:"6px 0" }}>{c.icon} {c.name}</div>)}
          </div>
          <div>
            <h4 style={{ fontWeight:700, fontSize:14, marginBottom:16, textTransform:"uppercase", letterSpacing:".05em", color:"var(--text-tertiary)" }}>Newsletter</h4>
            <p style={{ fontSize:14, color:"var(--text-secondary)", marginBottom:12, lineHeight:1.5 }}>Weekly updates delivered to your inbox.</p>
            <NewsletterSection variant="minimal"/>
          </div>
        </div>
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:20, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, fontSize:13, color:"var(--text-tertiary)" }}>
          <span>© 2026 The Jaaga Desk. All rights reserved.</span>
          <div style={{ display:"flex", gap:20 }}>
            <a href="https://www.freeprivacypolicy.com/" target="_blank" rel="noopener noreferrer" style={{ color:"var(--text-tertiary)" }}>Privacy Policy</a>
            <a href="https://www.termsfeed.com/public/live/generic" target="_blank" rel="noopener noreferrer" style={{ color:"var(--text-tertiary)" }}>Terms</a>
            <span onClick={()=>setPage({name:"about"})} style={{ cursor:"pointer" }}>Contact</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ═══════════════════════════════════════════════════════════════
// BACK TO TOP + READING PROGRESS
// ═══════════════════════════════════════════════════════════════

const BackToTop = () => {
  const [v, setV] = useState(false);
  useEffect(() => { const fn=()=>setV(window.scrollY>400); window.addEventListener("scroll",fn); return ()=>window.removeEventListener("scroll",fn); }, []);
  return <button className={`back-to-top ${v?"visible":""}`} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}><I n="arrowUp" s={20}/></button>;
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [page, setPageState] = useState({ name: "home" });
  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("jd:theme") || "light");
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Wrap setPage to update document title
  const setPage = useCallback((p) => {
    setPageState(p);
    const titles = { home:"Home", categories:"Topics", trending:"Trending", about:"About", admin:"Dashboard", write:"Write", profile:"Profile", bookmarks:"Bookmarks", login:"Sign In", register:"Sign Up" };
    document.title = `${titles[p.name] || "Article"} — The Jaaga Desk`;
  }, []);

  const addToast = useCallback((message, type = "info") => { const id = genId(); setToasts(prev => [...prev, { id, message, type }]); setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000); }, []);
  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Load posts
  const loadPosts = useCallback(() => {
    const idx = DB.get("posts:index") || [];
    const loaded = idx.map(id => DB.get(`post:${id}`)).filter(Boolean);
    loaded.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setPosts(loaded);
  }, []);

  // PERSISTENT SESSION — restore from localStorage on mount
  useEffect(() => {
    const savedSession = DB.get("session:current");
    if (savedSession) {
      // Verify user still exists in DB
      const user = DB.get(`user:${savedSession.id}`);
      if (user && user.verified) {
        setCurrentUser(user);
        // Admin goes to dashboard on initial load
        if (user.role === "admin") {
          setPageState({ name: "admin" });
          document.title = "Dashboard — The Jaaga Desk";
        }
      } else {
        DB.delete("session:current");
      }
    }
    const cats = DB.get("categories");
    setCategories(cats || []);
    loadPosts();
  }, [loadPosts]);

  // Reload posts when refreshKey changes
  useEffect(() => {
    const cats = DB.get("categories");
    setCategories(cats || []);
    loadPosts();
  }, [refreshKey, loadPosts]);

  // Persist theme
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("jd:theme", theme); }, [theme]);

  // LOGIN saves session to localStorage
  const login = useCallback((user) => {
    setCurrentUser(user);
    DB.set("session:current", { id: user.id }); // Only store ID, load fresh data on restore
  }, []);

  // LOGOUT clears session
  const logout = useCallback(() => {
    setCurrentUser(null);
    DB.delete("session:current");
    setPage({ name: "home" });
    addToast("Signed out", "info");
  }, [addToast, setPage]);

  const toggleTheme = useCallback(() => setTheme(prev => prev === "light" ? "dark" : "light"), []);

  const contextValue = useMemo(() => ({
    page, setPage, currentUser, setCurrentUser, login, logout,
    theme, toggleTheme, posts, categories, addToast, triggerRefresh,
  }), [page, setPage, currentUser, login, logout, theme, toggleTheme, posts, categories, addToast, triggerRefresh]);

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
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"var(--bg-primary)", color:"var(--text-primary)" }}>
        <Header />
        <main style={{ flex: 1 }}>{renderPage()}</main>
        <Footer />
        <BackToTop />
        <ToastContainer toasts={toasts} />
      </div>
    </AppContext.Provider>
  );
}
