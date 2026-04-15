// ═══════════════════════════════════════════════════════════════════════════
// src/App.jsx — THE JAAGA DESK (Firebase Version)
//
// This file is your existing the-jaaga-desk-fixed.jsx with the entire
// localStorage DB layer REPLACED by Firebase calls from src/lib/db.js
//
// KEY CHANGES FROM THE OLD VERSION:
//   • DB.get/set/delete → PostsAPI, CommentsAPI, etc. (async)
//   • localStorage session → Firebase Auth (automatic, cross-device)
//   • All data is live and shared across all browsers globally
//   • Real-time listeners on posts and comments with onSnapshot
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";
import {
  PostsAPI,
  CommentsAPI,
  LikesAPI,
  BookmarksAPI,
  CategoriesAPI,
  SubscribersAPI,
  ActivityAPI,
  HistoryAPI,
  UsersAPI,
  AuthAPI,
} from "./lib/db";
import { useAuth, AuthProvider } from "./context/AuthContext";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const ROLES = {
  admin:  { level: 100, label: "Admin",  color: "#c45d3e", permissions: ["all"] },
  editor: { level: 75,  label: "Editor", color: "#8b5cf6", permissions: ["write", "edit_all", "moderate_comments", "manage_categories"] },
  author: { level: 50,  label: "Author", color: "#2d6a4f", permissions: ["write", "edit_own"] },
  reader: { level: 10,  label: "Reader", color: "#6b7280", permissions: ["read", "comment", "bookmark"] },
};

export const canDo = (role, action) => {
  if (!role) return false;
  const r = ROLES[role];
  if (!r) return false;
  if (r.permissions.includes("all")) return true;
  return r.permissions.includes(action);
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────

export const formatDate = (d) => {
  if (!d) return "";
  const dt = new Date(d), now = new Date(), diff = now - dt;
  if (diff < 60000)    return "Just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const genId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const renderMd = (text) => {
  if (!text) return "";
  return text
    .replace(/^### (.*$)/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.*$)/gm,  '<h2 class="md-h2">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
};

// ─── APP CONTEXT ──────────────────────────────────────────────────────────────

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// ─── HASH ROUTING (page persistence on refresh) ────────────────────────────

const pageToHash = (p) => {
  if (!p || p.name === "home") return "#/";
  if (p.id && p.query === undefined) return `#/${p.name}/${p.id}`;
  if (p.query !== undefined) return `#/search/${encodeURIComponent(p.query)}`;
  return `#/${p.name}`;
};

const hashToPage = (hash) => {
  const h = hash.replace(/^#\/?/, "");
  if (!h || h === "/") return { name: "home" };
  const parts = h.split("/");
  const name = parts[0];
  if (name === "search") return { name: "search", query: decodeURIComponent(parts[1] || "") };
  if (parts[1]) return { name, id: parts[1] };
  return { name };
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

function AppInner() {
  const { currentUser, logout: authLogout } = useAuth();

  const [page, setPageState] = useState(() => hashToPage(window.location.hash));
  const [theme, setTheme]    = useState(() => localStorage.getItem("jd:theme") || "light");
  const [posts, setPosts]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [toasts, setToasts]  = useState([]);

  // ── Routing ────────────────────────────────────────────────────────────
  const setPage = useCallback((p) => {
    setPageState(p);
    const titles = {
      home: "Home", categories: "Topics", trending: "Trending", about: "About",
      admin: "Dashboard", write: "Write", profile: "Profile",
      bookmarks: "Bookmarks", login: "Sign In", register: "Sign Up",
    };
    document.title = `${titles[p.name] || "Article"} — The Jaaga Desk`;
    window.location.hash = pageToHash(p);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const p = hashToPage(window.location.hash);
      setPageState(p);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // ── Toasts ─────────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = "info") => {
    const id = genId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ── Real-time posts listener ────────────────────────────────────────────
  // Loads published posts for everyone; admins/editors also get drafts
  useEffect(() => {
    const unsubscribe = PostsAPI.onPublishedChange((livePosts) => {
      setPosts(livePosts);
    });
    return unsubscribe;
  }, []);

  // ── Admin: also load ALL posts including drafts ───────────────────────
  useEffect(() => {
    if (currentUser && (currentUser.role === "admin" || currentUser.role === "editor")) {
      PostsAPI.getAll().then(allPosts => {
        setPosts(allPosts);
      }).catch(() => {});
    }
  }, [currentUser]);

  // ── Check if first-run setup needed ──────────────────────────────────────
  useEffect(() => {
    // If nobody is logged in and we're on the home page, check if any users exist
    if (!currentUser) {
      import("firebase/firestore").then(({ getDocs, collection }) =>
        import("./lib/firebase").then(({ db }) =>
          getDocs(collection(db, "users")).then(snap => {
            if (snap.empty) {
              // No users at all — show the admin setup page
              setPage({ name: "setup" });
            }
          })
        )
      ).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load categories once ─────────────────────────────────────────────────
  useEffect(() => {
    // Always load categories first (pure read, works for everyone)
    CategoriesAPI.getAll().then(cats => {
      if (cats.length > 0) {
        setCategories(cats);
      } else {
        // None exist yet — try to seed them
        CategoriesAPI.seed().then(() => CategoriesAPI.getAll().then(setCategories));
      }
    }).catch(() => {
      // Fallback: use hardcoded categories so the site doesn't break
      setCategories([
        { id: "tech",      name: "Technology",     icon: "💻", color: "#0ea5e9", description: "Latest in tech, AI, and innovation" },
        { id: "lifestyle", name: "Lifestyle",       icon: "🌿", color: "#10b981", description: "Living well, productivity, and growth" },
        { id: "business",  name: "Business",        icon: "📊", color: "#8b5cf6", description: "Strategy, entrepreneurship, and markets" },
        { id: "culture",   name: "Culture",         icon: "🎭", color: "#f59e0b", description: "Arts, traditions, and society" },
        { id: "science",   name: "Science",         icon: "🔬", color: "#ef4444", description: "Discoveries, research, and breakthroughs" },
        { id: "travel",    name: "Travel",          icon: "✈️", color: "#06b6d4", description: "Adventures, destinations, and guides" },
        { id: "food",      name: "Food & Recipes",  icon: "🍳", color: "#ec4899", description: "Cooking, nutrition, and culinary arts" },
        { id: "opinion",   name: "Opinion",         icon: "💬", color: "#6366f1", description: "Perspectives, analysis, and commentary" },
      ]);
    });
  }, []);

  // ── Admin redirect on login ─────────────────────────────────────────────
  useEffect(() => {
    if (currentUser?.role === "admin") {
      const currentHash = window.location.hash;
      const isDefault = !currentHash || currentHash === "#/" || currentHash === "#";
      if (isDefault) {
        setPageState({ name: "admin" });
        window.location.hash = "#/admin";
      }
    }
  }, [currentUser]);

  // ── Theme persistence ───────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("jd:theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(prev => prev === "light" ? "dark" : "light"), []);

  const logout = useCallback(async () => {
    await authLogout();
    setPage({ name: "home" });
    addToast("Signed out", "info");
  }, [authLogout, setPage, addToast]);

  // ── Context value ───────────────────────────────────────────────────────
  const contextValue = useMemo(() => ({
    page, setPage, currentUser, theme, toggleTheme,
    posts, categories, addToast, logout,
  }), [page, setPage, currentUser, theme, toggleTheme, posts, categories, addToast, logout]);

  const renderPage = () => {
    switch (page.name) {
      case "home":       return <HomePage />;
      case "article":    return <ArticlePage articleId={page.id} />;
      case "write":      return <WritePage />;
      case "edit":       return <WritePage editId={page.id} />;
      case "login":
      case "register":   return <AuthPage mode={page.name} />;
      case "admin":      return <AdminDashboard />;
      case "categories": return <CategoriesPage />;
      case "category":   return <CategoryPage categoryId={page.id} />;
      case "trending":   return <TrendingPage />;
      case "search":     return <SearchPage query={page.query} />;
      case "bookmarks":  return <BookmarksPage />;
      case "profile":    return <ProfilePage />;
      case "about":      return <AboutPage />;
      case "setup":      return <AdminSetupPage />;
      default:           return <HomePage />;
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

// Wrap with AuthProvider so useAuth() works everywhere
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}


// ─── FIRST-RUN ADMIN SETUP ───────────────────────────────────────────────────
// This page only appears when there are no users in the database yet.
// It creates the admin account directly.

const AdminSetupPage = () => {
  const { login } = useAuth();
  const { setPage, addToast } = useApp();
  const [form, setForm] = useState({ displayName: "Idris Jaaga", username: "Idris", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSetup = async () => {
    if (!form.email || !form.password || !form.displayName || !form.username) {
      addToast("Please fill in all fields", "error"); return;
    }
    if (form.password.length < 6) { addToast("Password must be at least 6 characters", "error"); return; }
    setLoading(true);
    try {
      // 1. Create the account
      const cred = await import("firebase/auth").then(m =>
        m.createUserWithEmailAndPassword(import("./lib/firebase").then(f => f.auth), form.email, form.password)
      );
    } catch(e) {}

    try {
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      const { auth, db } = await import("./lib/firebase");

      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        username: form.username,
        displayName: form.displayName,
        email: form.email,
        role: "admin",         // ← This is the key: first user is ADMIN
        bio: "Founder & Editor-in-Chief of The Jaaga Desk.",
        avatar: null,
        verified: true,
        joinedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
      setDone(true);
      addToast("Admin account created! Signing you in...", "success");
      setTimeout(async () => {
        await login({ usernameOrEmail: form.email, password: form.password });
        setPage({ name: "admin" });
      }, 1500);
    } catch (err) {
      console.error(err);
      if (err.message?.includes("email-already-in-use")) {
        addToast("That email is already registered. Use the Sign In page instead.", "error");
      } else {
        addToast("Setup failed: " + err.message, "error");
      }
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "calc(100vh - var(--header-height))", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="anim-up" style={{ maxWidth: 460, width: "100%", background: "var(--bg-card)", border: "2px solid var(--accent)", borderRadius: "var(--radius-lg)", padding: "40px 32px", boxShadow: "var(--shadow-xl)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24 }}>J</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", marginBottom: 8 }}>Welcome to The Jaaga Desk</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>No admin account exists yet. Create yours now to get started.</p>
        </div>
        {done ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
            <p style={{ fontWeight: 600, color: "var(--accent)" }}>Admin account created! Signing you in…</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={labelStyle}>Your Name (Display Name)</label><input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} placeholder="Idris Jaaga" style={inputStyle}/></div>
            <div><label style={labelStyle}>Username (for login)</label><input value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="Idris" style={inputStyle}/></div>
            <div><label style={labelStyle}>Email Address</label><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" placeholder="your@email.com" style={inputStyle}/></div>
            <div><label style={labelStyle}>Password</label><PasswordInput value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" style={inputStyle}/></div>
            <button onClick={handleSetup} disabled={loading} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "var(--radius-xl)", background: loading ? "var(--bg-secondary)" : "var(--accent)", color: loading ? "var(--text-tertiary)" : "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer", marginTop: 8 }}>
              {loading ? "Creating account…" : "Create Admin Account →"}
            </button>
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>Already have an account? <span onClick={() => setPage({name:"login"})} style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>Sign In</span></p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── AUTH PAGE ────────────────────────────────────────────────────────────────
// Replaces the old localStorage auth with real Firebase Auth

const AuthPage = ({ mode = "login" }) => {
  const { login, register } = useAuth();
  const { setPage, addToast } = useApp();
  const [isLogin, setIsLogin] = useState(mode === "login");
  const [form, setForm]     = useState({ username: "", email: "", password: "", displayName: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isLogin) {
        const user = await login({ usernameOrEmail: form.username, password: form.password });
        addToast(`Welcome back, ${user.displayName}!`, "success");
        setPage({ name: user.role === "admin" ? "admin" : "home" });
      } else {
        if (!form.username || !form.email || !form.password || !form.displayName) {
          addToast("Please fill all fields", "error"); return;
        }
        if (form.password.length < 6) {
          addToast("Password must be at least 6 characters", "error"); return;
        }
        // Register then immediately log in — no email verification step
        await register({ email: form.email, password: form.password, username: form.username, displayName: form.displayName });
        // Small delay to let Firestore write settle, then sign in
        await new Promise(r => setTimeout(r, 800));
        const user = await login({ usernameOrEmail: form.email, password: form.password });
        addToast(`Welcome to The Jaaga Desk, ${user.displayName}!`, "success");
        setPage({ name: user.role === "admin" ? "admin" : "home" });
      }
    } catch (err) {
      let msg = "Something went wrong — please try again";
      if (err.message === "Username already taken") msg = "That username is already taken";
      else if (err.message === "User not found") msg = "No account found with that username or email";
      else if (err.message?.includes("email-already-in-use")) msg = "An account with that email already exists";
      else if (err.message?.includes("wrong-password") || err.message?.includes("invalid-credential") || err.message?.includes("INVALID_LOGIN_CREDENTIALS")) msg = "Incorrect email or password";
      else if (err.message?.includes("too-many-requests")) msg = "Too many attempts — please wait a few minutes";
      else if (err.message?.includes("network")) msg = "Network error — check your internet connection";
      else if (err.message?.includes("weak-password")) msg = "Password must be at least 6 characters";
      console.error("Auth error:", err.message);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "calc(100vh - var(--header-height))", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="anim-up" style={{ maxWidth: 420, width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "40px 32px", boxShadow: "var(--shadow-lg)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24 }}>J</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", marginBottom: 4 }}>{isLogin ? "Welcome back" : "Join The Jaaga Desk"}</h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{isLogin ? "Sign in to your account" : "Create your free account"}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!isLogin && <div><label style={labelStyle}>Display Name</label><input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="Idris Jaaga" style={inputStyle} /></div>}
          <div><label style={labelStyle}>{isLogin ? "Username or Email" : "Username"}</label><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder={isLogin ? "Idris" : "yourusername"} style={inputStyle} /></div>
          {!isLogin && <div><label style={labelStyle}>Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" placeholder="you@example.com" style={inputStyle} /></div>}
          <div><label style={labelStyle}>Password</label><PasswordInput value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={isLogin ? "Your password" : "Min 6 characters"} style={inputStyle} /></div>
          <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "var(--radius-xl)", background: loading ? "var(--bg-secondary)" : "var(--accent)", color: loading ? "var(--text-tertiary)" : "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer", marginTop: 8 }}>
            {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
          </button>
        </div>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-tertiary)" }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => setIsLogin(!isLogin)} style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>{isLogin ? "Sign Up" : "Sign In"}</span>
        </p>
      </div>
    </div>
  );
};

// ─── ARTICLE PAGE ─────────────────────────────────────────────────────────────
// Now loads from Firestore, with real-time comments

const ArticlePage = ({ articleId }) => {
  const { categories, currentUser, setPage, addToast } = useApp();
  const [article,     setArticle]     = useState(null);
  const [comments,    setComments]    = useState([]);
  const [commentText, setCommentText] = useState("");
  const [guestName,   setGuestName]   = useState("");
  const [liked,       setLiked]       = useState(false);
  const [bookmarked,  setBookmarked]  = useState(false);
  const [loadError,   setLoadError]   = useState(false);

  // Load article and set up real-time comments listener
  useEffect(() => {
    let unsubComments;

    const init = async () => {
      try {
        const post = await PostsAPI.getById(articleId);
        if (!post) { setLoadError(true); return; }
        setArticle(post);

        // Increment view count (fire-and-forget)
        PostsAPI.incrementViews(articleId);

        // Track reading history
        if (currentUser?.uid) {
          HistoryAPI.addRead(currentUser.uid, articleId);
          const bm = await BookmarksAPI.isBookmarked(currentUser.uid, articleId);
          setBookmarked(bm);
          const lk = await LikesAPI.hasLiked(articleId, currentUser.uid);
          setLiked(lk);
        }

        // Subscribe to real-time comments for this post
        unsubComments = CommentsAPI.onPostCommentsChange(articleId, setComments);
      } catch (err) {
        console.error("Failed to load article:", err);
        setLoadError(true);
      }
    };

    init();
    window.scrollTo(0, 0);
    return () => { if (unsubComments) unsubComments(); };
  }, [articleId, currentUser]);

  if (loadError) return <div className="container" style={{ padding: "80px 0", textAlign: "center" }}><p style={{ color: "var(--text-tertiary)" }}>Article not found.</p></div>;
  if (!article)  return <div className="container" style={{ padding: "80px 0", textAlign: "center" }}><div style={{ width: "60%", height: 40, margin: "0 auto", background: "var(--bg-secondary)", borderRadius: 8 }} /></div>;

  const cat     = categories?.find(c => c.id === article.category);
  const related = []; // TODO: fetch related posts by category

  const toggleLike = async () => {
    if (!currentUser) { addToast("Please sign in to like", "info"); return; }
    const { liked: newLiked } = await LikesAPI.toggle(articleId, currentUser.uid);
    setLiked(newLiked);
    setArticle(prev => ({ ...prev, likes: (prev.likes || 0) + (newLiked ? 1 : -1) }));
  };

  const toggleBookmark = async () => {
    if (!currentUser) { addToast("Please sign in to bookmark", "info"); return; }
    const { bookmarked: bm } = await BookmarksAPI.toggle(currentUser.uid, articleId);
    setBookmarked(bm);
    addToast(bm ? "Saved to bookmarks!" : "Removed from bookmarks", bm ? "success" : "info");
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    if (!currentUser && !guestName.trim()) { addToast("Please enter your name", "info"); return; }
    try {
      await CommentsAPI.create({
        postId:     articleId,
        authorUid:  currentUser?.uid || null,
        authorName: currentUser?.displayName || guestName.trim(),
        content:    commentText.trim(),
        isGuest:    !currentUser,
      });
      setCommentText("");
      addToast("Comment posted!", "success");
    } catch (err) {
      addToast("Failed to post comment", "error");
    }
  };

  return (
    <article className="container" style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 13, color: "var(--text-tertiary)" }}>
        <span style={{ cursor: "pointer" }} onClick={() => setPage({ name: "home" })}>Home</span>
        <I n="chevRight" s={12} />
        {cat && <><span style={{ cursor: "pointer", color: cat.color }} onClick={() => setPage({ name: "category", id: cat.id })}>{cat.name}</span><I n="chevRight" s={12} /></>}
        <span>Article</span>
      </div>

      <h1 className="anim-up" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.75rem,4vw,2.75rem)", lineHeight: 1.2, marginBottom: 16, letterSpacing: "-.02em" }}>{article.title}</h1>

      <div className="anim-in" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={article.authorName} size={40} fs={16} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{article.authorName}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{formatDate(article.publishedAt)} · {article.readTime} min read</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button onClick={toggleLike} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: liked ? "var(--accent-light)" : "var(--bg-card)", color: liked ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}><I n="heart" s={16} /> {article.likes || 0}</button>
          <button onClick={toggleBookmark} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: bookmarked ? "var(--accent-light)" : "var(--bg-card)", color: bookmarked ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer" }}><I n="bookmark" s={16} /></button>
          <button onClick={() => { navigator.clipboard?.writeText(window.location.href); addToast("Link copied!", "success"); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer" }}><I n="share" s={16} /></button>
        </div>
      </div>

      {article.coverImage && <div className="anim-up" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 40, aspectRatio: "16/8", background: `url(${article.coverImage}) center/cover` }} />}
      <div className="article-body" style={{ fontFamily: "var(--font-body)", fontSize: "1.125rem", lineHeight: 1.85, color: "var(--text-secondary)", marginBottom: 48 }} dangerouslySetInnerHTML={{ __html: `<p>${renderMd(article.content)}</p>` }} />

      {/* Tags */}
      {article.tags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 48, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
          {article.tags.map(t => <span key={t} onClick={() => setPage({ name: "search", query: t })} style={{ padding: "6px 14px", borderRadius: "var(--radius-xl)", background: "var(--bg-secondary)", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", fontWeight: 500 }}>#{t}</span>)}
        </div>
      )}

      {/* Ad slot */}
      <AdSlot slot="in-article" label="Advertisement" />

      {/* Comments */}
      <section style={{ borderTop: "1px solid var(--border)", paddingTop: 40 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.375rem", marginBottom: 24 }}>Comments ({comments.length})</h3>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Avatar src={currentUser?.avatar} name={currentUser?.displayName || "G"} size={36} />
            {currentUser ? <span style={{ fontWeight: 600, fontSize: 14 }}>{currentUser.displayName}</span> : <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Your name" style={{ ...inputStyle, maxWidth: 200 }} />}
          </div>
          <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Share your thoughts…" rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, marginBottom: 12 }} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={postComment} disabled={!commentText.trim()} style={{ padding: "10px 24px", border: "none", borderRadius: "var(--radius-xl)", background: commentText.trim() ? "var(--accent)" : "var(--bg-secondary)", color: commentText.trim() ? "#fff" : "var(--text-tertiary)", cursor: commentText.trim() ? "pointer" : "default", fontSize: 14, fontWeight: 600 }}>Post Comment</button>
          </div>
        </div>
        {comments.length === 0
          ? <p style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "32px 0" }}>No comments yet. Be the first!</p>
          : <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{comments.map((c, i) => (
            <div key={c.id} className="anim-in" style={{ padding: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", animationDelay: `${i * .05}s` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <Avatar name={c.authorName} size={32} fs={12} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{c.authorName}</span>
                {c.isGuest && <Badge text="Guest" color="#6b7280" />}
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: "auto" }}>{formatDate(c.createdAt)}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>{c.content}</p>
            </div>
          ))}</div>
        }
      </section>
    </article>
  );
};

// ─── WRITE PAGE ───────────────────────────────────────────────────────────────

const WritePage = ({ editId = null }) => {
  const { currentUser, setPage, addToast, categories } = useApp();
  const [title,    setTitle]    = useState("");
  const [content,  setContent]  = useState("");
  const [excerpt,  setExcerpt]  = useState("");
  const [category, setCategory] = useState("");
  const [tags,     setTags]     = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status,   setStatus]   = useState("draft");
  const [featured, setFeatured] = useState(false);
  const [preview,  setPreview]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!currentUser) { setPage({ name: "login" }); return; }
    if (!canDo(currentUser.role, "write")) { addToast("No permission to write", "error"); setPage({ name: "home" }); return; }
    if (editId) {
      PostsAPI.getById(editId).then(p => {
        if (!p) return;
        if (p.author !== currentUser.uid && !canDo(currentUser.role, "edit_all")) {
          addToast("You can only edit your own articles", "error");
          setPage({ name: "home" });
          return;
        }
        setTitle(p.title); setContent(p.content); setExcerpt(p.excerpt || "");
        setCategory(p.category); setTags(p.tags?.join(", ") || "");
        setCoverUrl(p.coverImage || ""); setStatus(p.status); setFeatured(p.featured || false);
      });
    }
  }, [editId, currentUser, setPage, addToast]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) { addToast("Title and content required", "error"); return; }
    setSaving(true);
    try {
      const data = {
        title, content, excerpt,
        category: category || "tech",
        tags:     tags.split(",").map(t => t.trim()).filter(Boolean),
        coverImage: coverUrl || "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=400&fit=crop",
        status, featured,
        authorUid:  currentUser.uid,
        authorName: currentUser.displayName,
      };

      let postId;
      if (editId) {
        await PostsAPI.update(editId, data);
        postId = editId;
        addToast("Article updated!", "success");
      } else {
        const created = await PostsAPI.create(data);
        postId = created.id;
        addToast("Article published!", "success");
      }

      // Handle cover image file upload if user picked a local file
      if (coverUrl.startsWith("data:")) {
        await PostsAPI.uploadCoverImage(postId, coverUrl);
      }

      setPage({ name: "article", id: postId });
    } catch (err) {
      addToast("Failed to save article: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser || !canDo(currentUser.role, "write")) return null;

  return (
    <div className="container" style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>{editId ? "Edit Article" : "Write New Article"}</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setPreview(!preview)} style={{ padding: "10px 20px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: preview ? "var(--accent-light)" : "var(--bg-card)", color: preview ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>{preview ? "Edit" : "Preview"}</button>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "10px 16px", borderRadius: "var(--radius-xl)" }}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <button onClick={handleSave} disabled={saving} style={{ padding: "10px 24px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "#fff", cursor: saving ? "default" : "pointer", fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : editId ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      {preview ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "40px 32px" }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem", marginBottom: 16 }}>{title || "Untitled"}</h1>
          {coverUrl && <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: 24, aspectRatio: "16/8", background: `url(${coverUrl}) center/cover` }} />}
          <div className="article-body" dangerouslySetInnerHTML={{ __html: `<p>${renderMd(content)}</p>` }} style={{ fontSize: "1.125rem", lineHeight: 1.85, color: "var(--text-secondary)" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title…" style={{ ...inputStyle, fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, padding: "16px 20px", border: "none", borderBottom: "2px solid var(--border)" }} />
          <div>
            <label style={labelStyle}>Cover Image</label>
            <div style={{ display: "flex", gap: 12 }}>
              <input value={coverUrl.startsWith("data:") ? "(local file selected)" : coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="Paste image URL or upload a file…" style={{ ...inputStyle, flex: 1 }} />
              <input type="file" ref={fileRef} accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setCoverUrl(ev.target.result); r.readAsDataURL(f); } }} />
              <button onClick={() => fileRef.current?.click()} style={{ padding: "12px 18px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}><I n="image" s={16} /> Upload</button>
            </div>
            {coverUrl && !coverUrl.startsWith("data:") && <div style={{ marginTop: 12, borderRadius: "var(--radius-md)", overflow: "hidden", aspectRatio: "16/6", background: `url(${coverUrl}) center/cover`, border: "1px solid var(--border)" }} />}
          </div>
          <div><label style={labelStyle}>Excerpt</label><textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Brief summary…" rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={labelStyle}>Category</label><select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}><option value="">Select…</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
            <div><label style={labelStyle}>Tags</label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="comma, separated" style={inputStyle} /></div>
          </div>
          {canDo(currentUser.role, "all") && <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}><input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} /><span style={{ fontWeight: 500 }}>Feature on homepage</span></label>}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={labelStyle}>Content (Markdown supported)</label>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your article…" rows={20} style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 14, lineHeight: 1.7, resize: "vertical", minHeight: 400 }} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────

const ProfilePage = () => {
  const { currentUser, addToast }  = useApp();
  const { refreshUser, setCurrentUser } = useAuth();
  const [bio,         setBio]         = useState(currentUser?.bio || "");
  const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
  const [curPw,       setCurPw]       = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const avatarRef = useRef(null);

  if (!currentUser) return null;

  const saveProfile = async () => {
    try {
      await UsersAPI.updateProfile(currentUser.uid, { displayName, bio });
      await refreshUser();
      addToast("Profile updated!", "success");
    } catch { addToast("Failed to update profile", "error"); }
  };

  const changePw = async () => {
    if (newPw.length < 6) { addToast("Min 6 characters", "error"); return; }
    if (newPw !== confirmPw) { addToast("Passwords don't match", "error"); return; }
    try {
      await AuthAPI.changePassword({ currentPassword: curPw, newPassword: newPw });
      setCurPw(""); setNewPw(""); setConfirmPw("");
      addToast("Password changed!", "success");
    } catch { addToast("Current password is incorrect", "error"); }
  };

  const uploadAvatar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async (ev) => {
      try {
        const url = await UsersAPI.uploadAvatar(currentUser.uid, ev.target.result);
        await refreshUser();
        addToast("Avatar updated!", "success");
      } catch { addToast("Failed to upload avatar", "error"); }
    };
    r.readAsDataURL(f);
  };

  return (
    <div className="container" style={{ padding: "40px 24px 80px", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", marginBottom: 32 }}>My Profile</h1>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 32, marginBottom: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <Avatar src={currentUser.avatar} name={displayName} size={80} fs={32} />
            <button onClick={() => avatarRef.current?.click()} style={{ position: "absolute", bottom: -4, right: -4, width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "#fff", border: "3px solid var(--bg-card)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><I n="camera" s={14} /></button>
            <input type="file" ref={avatarRef} accept="image/*" style={{ display: "none" }} onChange={uploadAvatar} />
          </div>
          <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 12 }}>
            Member since {formatDate(currentUser.joinedAt)} · <Badge text={ROLES[currentUser.role]?.label || currentUser.role} color={ROLES[currentUser.role]?.color || "#6b7280"} />
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label style={labelStyle}>Display Name</label><input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Bio</label><textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="About you…" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} /></div>
          <button onClick={saveProfile} style={{ padding: "12px 24px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, alignSelf: "flex-end" }}>Save Changes</button>
        </div>
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 32 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: 20 }}>Change Password</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label style={labelStyle}>Current Password</label><PasswordInput value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="Current password" style={inputStyle} /></div>
          <div><label style={labelStyle}>New Password</label><PasswordInput value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters" style={inputStyle} /></div>
          <div><label style={labelStyle}>Confirm New Password</label><PasswordInput value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Confirm" style={inputStyle} /></div>
          <button onClick={changePw} style={{ padding: "12px 24px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, alignSelf: "flex-end" }}>Update Password</button>
        </div>
      </div>
    </div>
  );
};

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const { posts, currentUser, setPage, addToast, categories } = useApp();
  const [tab,      setTab]      = useState("overview");
  const [users,    setUsers]    = useState([]);
  const [comments, setComments] = useState([]);
  const [subs,     setSubs]     = useState([]);
  const [activity, setActivity] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin") return;
    Promise.all([
      UsersAPI.getAll(),
      CommentsAPI.getAll(200),
      SubscribersAPI.getAll(),
      ActivityAPI.getRecent(100),
    ]).then(([u, c, s, a]) => { setUsers(u); setComments(c); setSubs(s); setActivity(a); });
  }, [currentUser]);

  if (!currentUser || currentUser.role !== "admin") {
    return <div className="container" style={{ padding: "80px 0", textAlign: "center" }}><h2>Access Denied</h2></div>;
  }

  const pub        = posts.filter(p => p.status === "published");
  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const verifiedS  = subs.filter(s => s.verified).length;

  const handleDelete = async (id) => {
    await PostsAPI.delete(id);
    addToast("Deleted", "info");
    setDeleteId(null);
  };

  const handleDeleteComment = async (cid) => {
    await CommentsAPI.delete(cid);
    setComments(prev => prev.filter(c => c.id !== cid));
    addToast("Comment removed", "info");
  };

  const handleRemoveSub = async (email) => {
    await SubscribersAPI.remove(email);
    setSubs(prev => prev.filter(s => s.email !== email));
    addToast("Subscriber removed", "info");
  };

  const handleRoleChange = async (uid, newRole) => {
    await UsersAPI.setRole(uid, newRole);
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    addToast(`Role updated to ${ROLES[newRole]?.label}`, "success");
    ActivityAPI.log("role_change", `User ${uid} → ${newRole}`);
  };

  const stats = [
    { label: "Articles",    value: posts.length,              icon: "edit",     color: "var(--accent)" },
    { label: "Published",   value: pub.length,                icon: "globe",    color: "var(--accent-secondary)" },
    { label: "Views",       value: totalViews.toLocaleString(), icon: "eye",    color: "#8b5cf6" },
    { label: "Likes",       value: totalLikes.toLocaleString(), icon: "heart",  color: "#ef4444" },
    { label: "Users",       value: users.length,              icon: "users",    color: "#06b6d4" },
    { label: "Subscribers", value: `${verifiedS}/${subs.length}`, icon: "mail", color: "#f59e0b" },
    { label: "Comments",    value: comments.length,           icon: "comment",  color: "#10b981" },
  ];

  const tabBtn = (t) => ({ padding: "10px 18px", border: "none", borderRadius: "var(--radius-xl)", background: tab === t ? "var(--accent)" : "var(--bg-secondary)", color: tab === t ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 14, fontWeight: 500 });

  return (
    <div className="container" style={{ padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.75rem" }}>Dashboard</h1>
        <button onClick={() => setPage({ name: "write" })} style={{ padding: "10px 24px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>+ New Article</button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <div key={s.label} className="anim-in" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "16px 18px", animationDelay: `${i * .04}s`, animationFillMode: "backwards" }}>
            <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: s.color + "15", color: s.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}><I n={s.icon} s={14} /></div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {["overview", "articles", "users", "roles", "comments", "subscribers", "activity"].map(t =>
          <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>{t === "roles" ? "👥 Roles" : t.charAt(0).toUpperCase() + t.slice(1)}</button>
        )}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }} className="main-grid">
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 16 }}>Recent Articles</h3>
            {posts.slice(0, 10).map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: i < 9 ? "1px solid var(--border-light)" : "none", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div><div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{p.views} views · {formatDate(p.createdAt)}</div></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Badge text={p.status} color={p.status === "published" ? "#10b981" : "#f59e0b"} />
                  <button onClick={() => setPage({ name: "edit", id: p.id })} style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "var(--accent)" }}><I n="edit" s={14} /></button>
                  <button onClick={() => setDeleteId(p.id)} style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "#ef4444" }}><I n="trash" s={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 12 }}>Recent Activity</h3>
            {activity.slice(0, 12).map((a, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: i < 11 ? "1px solid var(--border-light)" : "none", fontSize: 13 }}>
                <div style={{ color: "var(--text-secondary)" }}>{a.details}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{formatDate(a.timestamp)}</div>
              </div>
            ))}
            {activity.length === 0 && <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>No activity yet.</p>}
          </div>
        </div>
      )}

      {/* Articles */}
      {tab === "articles" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>{["Title", "Category", "Status", "Views", "Likes", "Date", "Actions"].map(h => <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 12, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{posts.map(p => {
                const cat = categories?.find(c => c.id === p.category);
                return <tr key={p.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{cat ? `${cat.icon} ${cat.name}` : "-"}</td>
                  <td style={{ padding: "12px 16px" }}><Badge text={p.status} color={p.status === "published" ? "#10b981" : "#f59e0b"} /></td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{p.views?.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{p.likes}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{formatDate(p.createdAt)}</td>
                  <td style={{ padding: "12px 16px" }}><div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setPage({ name: "article", id: p.id })} style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer" }}><I n="eye" s={14} /></button>
                    <button onClick={() => setPage({ name: "edit", id: p.id })} style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "var(--accent)" }}><I n="edit" s={14} /></button>
                    <button onClick={() => setDeleteId(p.id)} style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "#ef4444" }}><I n="trash" s={14} /></button>
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles tab */}
      {tab === "roles" && (
        <div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 16 }}>Role Permissions</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
              {Object.entries(ROLES).map(([key, val]) => (
                <div key={key} style={{ padding: 16, border: `2px solid ${val.color}22`, borderLeft: `4px solid ${val.color}`, borderRadius: "var(--radius-md)", background: "var(--bg-secondary)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Badge text={val.label} color={val.color} /><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Level {val.level}</span></div>
                  <ul style={{ listStyle: "none" }}>{val.permissions.map(p => <li key={p} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: val.color }}>✓</span> {p}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}><h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Assign Team Roles</h3></div>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>{["Member", "Email", "Current Role", "Change Role"].map(h => <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 12, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
              <tbody>{users.map(u => (
                <tr key={u.uid} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "14px 16px" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar src={u.avatar} name={u.displayName} size={32} fs={12} /><div><div style={{ fontWeight: 600 }}>{u.displayName}</div><div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>@{u.username}</div></div></div></td>
                  <td style={{ padding: "14px 16px", color: "var(--text-secondary)", fontSize: 13 }}>{u.email}</td>
                  <td style={{ padding: "14px 16px" }}><Badge text={ROLES[u.role]?.label || u.role} color={ROLES[u.role]?.color || "#6b7280"} /></td>
                  <td style={{ padding: "14px 16px" }}>
                    {u.uid === currentUser.uid
                      ? <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>You (owner)</span>
                      : <select defaultValue={u.role} onChange={e => handleRoleChange(u.uid, e.target.value)} style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
                        {Object.entries(ROLES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
                      </select>
                    }
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* Comments */}
      {tab === "comments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {comments.length === 0 ? <p style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No comments yet.</p>
            : comments.map(c => (
              <div key={c.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{c.authorName} {c.isGuest && <Badge text="Guest" color="#6b7280" />} <span style={{ color: "var(--text-tertiary)", fontWeight: 400, fontSize: 12, marginLeft: 8 }}>{formatDate(c.createdAt)}</span></div><p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 6 }}>{c.content}</p><span onClick={() => setPage({ name: "article", id: c.postId })} style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer" }}>View Article →</span></div>
                <button onClick={() => handleDeleteComment(c.id)} style={{ padding: 6, border: "none", background: "none", cursor: "pointer", color: "#ef4444", flexShrink: 0 }}><I n="trash" s={16} /></button>
              </div>
            ))}
        </div>
      )}

      {/* Subscribers */}
      {tab === "subscribers" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {subs.length === 0 ? <p style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>No subscribers yet.</p>
            : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>{["Email", "Status", "Subscribed", "Actions"].map(h => <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 12, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
              <tbody>{subs.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "12px 16px" }}>{s.email}</td>
                  <td style={{ padding: "12px 16px" }}><Badge text={s.verified ? "Verified" : "Pending"} color={s.verified ? "#10b981" : "#f59e0b"} /></td>
                  <td style={{ padding: "12px 16px", color: "var(--text-tertiary)" }}>{formatDate(s.subscribedAt)}</td>
                  <td style={{ padding: "12px 16px" }}><button onClick={() => handleRemoveSub(s.email)} style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", color: "#ef4444" }}><I n="trash" s={14} /></button></td>
                </tr>
              ))}</tbody>
            </table>}
        </div>
      )}

      {/* Activity */}
      {tab === "activity" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 16 }}>Activity Log ({activity.length})</h3>
          {activity.length === 0 ? <p style={{ color: "var(--text-tertiary)" }}>No activity yet.</p>
            : activity.map((a, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < activity.length - 1 ? "1px solid var(--border-light)" : "none", fontSize: 14 }}>
                <div><Badge text={a.action} color="#6366f1" /> <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{a.details}</span></div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", whiteSpace: "nowrap", marginLeft: 16 }}>{formatDate(a.timestamp)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && <Modal onClose={() => setDeleteId(null)}>
        <div style={{ padding: 32 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", marginBottom: 12 }}>Delete Article?</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>This will permanently delete the article and all its comments.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button onClick={() => setDeleteId(null)} style={{ padding: "10px 20px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={() => handleDelete(deleteId)} style={{ padding: "10px 20px", border: "none", borderRadius: "var(--radius-xl)", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Delete</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
};

// ─── REMAINING PAGE COMPONENTS ────────────────────────────────────────────────
// These are simpler and use the same pattern — read from Firebase via context

const HomePage = () => {
  const { posts, categories, setPage } = useApp();
  const pub      = posts.filter(p => p.status === "published");
  const feat     = pub.filter(p => p.featured).slice(0, 2);
  const latest   = pub.slice(0, 9);
  const trending = [...pub].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  return (
    <div>
      {feat.length > 0 && <section className="container" style={{ paddingTop: 40, paddingBottom: 32 }}><div style={{ display: "grid", gap: 24 }}>{feat.map((a, i) => <ArticleCard key={a.id} article={a} variant="featured" index={i} />)}</div></section>}
      <section className="container" style={{ paddingBottom: 48 }}>
        <div className="main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}><h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem" }}>Latest Stories</h2><span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{pub.length} articles</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>{latest.map((a, i) => <ArticleCard key={a.id} article={a} index={i} />)}</div>
          </div>
          <aside>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}><I n="trend" s={18} /> Trending Now</h3>
              {trending.map((a, i) => (
                <div key={a.id} onClick={() => setPage({ name: "article", id: a.id })} style={{ cursor: "pointer", display: "flex", gap: 12, padding: "12px 0", borderBottom: i < trending.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--border)", lineHeight: 1, minWidth: 28 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div><h4 style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, marginBottom: 2 }}>{a.title}</h4><span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{a.readTime}m · {a.views?.toLocaleString()} views</span></div>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: 16 }}>Explore Topics</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{categories?.map(c => <button key={c.id} onClick={() => setPage({ name: "category", id: c.id })} style={{ padding: "8px 14px", borderRadius: "var(--radius-xl)", border: "1px solid var(--border)", background: "var(--bg-primary)", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{c.icon} {c.name}</button>)}</div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", marginBottom: 8 }}>Newsletter</h3>
              <NewsletterSection variant="minimal" />
            </div>
            <AdSlot slot="sidebar" label="Sponsored" />
          </aside>
        </div>
      </section>
      <div className="container"><NewsletterSection /></div>
    </div>
  );
};

const CategoriesPage = () => { const { categories, posts, setPage } = useApp(); return <div className="container" style={{ padding: "40px 24px 80px" }}><h1 className="anim-up" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.75rem,3vw,2.5rem)", marginBottom: 32, textAlign: "center" }}>Explore Topics</h1><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20, maxWidth: 900, margin: "0 auto" }}>{categories?.map((c, i) => { const cnt = posts.filter(p => p.category === c.id && p.status === "published").length; return <div key={c.id} className="anim-in" onClick={() => setPage({ name: "category", id: c.id })} style={{ padding: 28, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", cursor: "pointer", animationDelay: `${i * .05}s`, animationFillMode: "backwards", borderLeft: `4px solid ${c.color}` }}><span style={{ fontSize: 32, marginBottom: 12, display: "block" }}>{c.icon}</span><h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", marginBottom: 4 }}>{c.name}</h3><p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 4 }}>{c.description}</p><p style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{cnt} article{cnt !== 1 ? "s" : ""}</p></div>; })}</div></div>; };
const CategoryPage = ({ categoryId }) => { const { categories, posts, setPage } = useApp(); const cat = categories?.find(c => c.id === categoryId); const cp = posts.filter(p => p.category === categoryId && p.status === "published"); return <div className="container" style={{ padding: "40px 24px 80px" }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 13, color: "var(--text-tertiary)" }}><span style={{ cursor: "pointer" }} onClick={() => setPage({ name: "home" })}>Home</span><I n="chevRight" s={12} /><span style={{ cursor: "pointer" }} onClick={() => setPage({ name: "categories" })}>Categories</span><I n="chevRight" s={12} /><span style={{ color: cat?.color }}>{cat?.name}</span></div><div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}><span style={{ fontSize: 48 }}>{cat?.icon}</span><div><h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "2rem" }}>{cat?.name}</h1><p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>{cp.length} articles</p></div></div>{cp.length === 0 ? <p style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>No articles yet.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 24 }}>{cp.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div>}</div>; };
const TrendingPage = () => { const { posts } = useApp(); const t = [...posts].filter(p => p.status === "published").sort((a, b) => (b.views || 0) - (a.views || 0)); return <div className="container" style={{ padding: "40px 24px 80px", maxWidth: 900, margin: "0 auto" }}><div style={{ textAlign: "center", marginBottom: 40 }}><h1 className="anim-up" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.75rem,3vw,2.5rem)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}><I n="fire" s={32} /> Trending</h1></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>{t.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div></div>; };
const SearchPage = ({ query }) => { const { posts } = useApp(); if (!query) return null; const q = query.toLowerCase(); const r = posts.filter(p => p.status === "published" && (p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)) || p.excerpt?.toLowerCase().includes(q))); return <div className="container" style={{ padding: "40px 24px 80px", maxWidth: 900, margin: "0 auto" }}><div style={{ marginBottom: 32 }}><p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 4 }}>Results for</p><h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.75rem" }}>"{query}"</h1><p style={{ color: "var(--text-tertiary)", fontSize: 14, marginTop: 4 }}>{r.length} result{r.length !== 1 ? "s" : ""}</p></div>{r.length === 0 ? <div style={{ textAlign: "center", padding: 60 }}><p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p><p style={{ color: "var(--text-tertiary)" }}>No articles found.</p></div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>{r.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div>}</div>; };

const BookmarksPage = () => {
  const { currentUser, posts } = useApp();
  const [bmIds, setBmIds] = useState([]);
  useEffect(() => { if (currentUser?.uid) BookmarksAPI.getForUser(currentUser.uid).then(setBmIds); }, [currentUser]);
  const bm = posts.filter(p => bmIds.includes(p.id));
  if (!currentUser) return <div className="container" style={{ padding: "80px 0", textAlign: "center" }}><p>Please sign in.</p></div>;
  return <div className="container" style={{ padding: "40px 24px 80px", maxWidth: 900, margin: "0 auto" }}><h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.75rem", marginBottom: 32 }}><I n="bookmark" s={24} style={{ verticalAlign: "middle", marginRight: 8 }} /> Bookmarks</h1>{bm.length === 0 ? <div style={{ textAlign: "center", padding: 60 }}><p style={{ fontSize: 48, marginBottom: 16 }}>📑</p><p style={{ color: "var(--text-tertiary)" }}>No bookmarks yet.</p></div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>{bm.map((p, i) => <ArticleCard key={p.id} article={p} index={i} />)}</div>}</div>;
};

const AboutPage = () => <div className="container" style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}><div className="anim-up"><h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(2rem,4vw,3rem)", marginBottom: 24, lineHeight: 1.2, textAlign: "center" }}>About The Jaaga Desk</h1><div style={{ width: 60, height: 4, borderRadius: 2, background: "var(--accent)", margin: "0 auto 40px" }} /><div style={{ fontSize: "1.125rem", lineHeight: 1.85, color: "var(--text-secondary)" }}><p style={{ marginBottom: 20 }}>The Jaaga Desk is a digital publication rooted in Northern Ghanaian heritage, dedicated to delivering thoughtful stories that inform, inspire, and illuminate.</p><p style={{ marginBottom: 20 }}>"Jaaga" carries the meaning of "a place" and "to be awake" — this space is both a gathering point and a call to consciousness.</p><p style={{ marginBottom: 32 }}>From technology to culture, science to food, travel to opinion — we explore the ideas that shape our world, always with depth and a distinctive perspective.</p><div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 32 }}><h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", marginBottom: 16 }}>Contact</h3><p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Email: <a href="mailto:hello@idrisjaaga.com" style={{ color: "var(--accent)" }}>hello@idrisjaaga.com</a></p></div></div></div><NewsletterSection /></div>;

// ─── NEWSLETTER ────────────────────────────────────────────────────────────────

const NewsletterSection = ({ variant = "default" }) => {
  const { addToast } = useApp();
  const [email, setEmail]       = useState("");
  const [success, setSuccess]   = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { addToast("Please enter a valid email", "error"); return; }
    try {
      await SubscribersAPI.subscribe(email);
      setSuccess(true);
      setEmail("");
      addToast("Check your email for a confirmation link!", "success");
    } catch (err) {
      if (err.message === "already_subscribed") {
        addToast("You're already subscribed!", "info");
      } else {
        addToast("Failed to subscribe. Try again.", "error");
      }
    }
  };

  if (success) return <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, textAlign: "center" }}><p style={{ fontSize: "1.25rem", marginBottom: 8 }}>📬</p><p style={{ fontWeight: 600 }}>Check your inbox!</p><p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Click the confirmation link we just sent you.</p></div>;

  if (variant === "minimal") return <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 8, maxWidth: 400 }}><input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="your@email.com" required style={{ ...inputStyle, flex: 1, borderRadius: "var(--radius-xl)" }} /><button type="submit" style={{ padding: "10px 20px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Subscribe</button></form>;

  return <section style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "clamp(32px,5vw,56px)", textAlign: "center", margin: "48px 0" }}><div style={{ fontSize: 36, marginBottom: 12 }}>📬</div><h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.5rem,3vw,2rem)", marginBottom: 8 }}>Stay in the loop</h2><p style={{ color: "var(--text-secondary)", fontSize: 16, maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.6 }}>Get the latest stories delivered straight to your inbox.</p><form onSubmit={handleSubscribe} style={{ display: "flex", gap: 10, maxWidth: 460, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}><input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Enter your email" required style={{ ...inputStyle, flex: "1 1 240px", borderRadius: "var(--radius-xl)" }} /><button type="submit" style={{ padding: "14px 32px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Subscribe</button></form></section>;
};

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────

const inputStyle = { width: "100%", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, outline: "none", transition: "border-color .2s", fontFamily: "inherit" };
const labelStyle = { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" };

const Avatar = ({ src, name, size = 36, fs = 14 }) => {
  if (src) return <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}><img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: fs, flexShrink: 0 }}>{name?.[0]?.toUpperCase() || "?"}</div>;
};

const PasswordInput = ({ value, onChange, placeholder, style: sx = {} }) => {
  const [show, setShow] = useState(false);
  return <div style={{ position: "relative" }}><input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} style={{ ...sx, paddingRight: 44 }} /><button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4, display: "flex" }}><I n={show ? "eyeOff" : "eye"} s={18} /></button></div>;
};

const Badge = ({ text, color }) => <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + "18", color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{text}</span>;
const Modal = ({ children, onClose, maxWidth = 480 }) => <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xl)", width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto" }}>{children}</div></div>;
const ToastContainer = ({ toasts }) => <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>{toasts.map(t => <div key={t.id} style={{ padding: "14px 20px", borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", fontSize: 14, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10, borderLeft: `4px solid ${t.type === "success" ? "var(--accent-secondary)" : t.type === "error" ? "#ef4444" : "var(--accent)"}` }}>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"} {t.message}</div>)}</div>;

const AdSlot = ({ slot, label = "Advertisement" }) => <div style={{ background: "var(--bg-secondary)", border: "1px dashed var(--border)", borderRadius: "var(--radius-md)", padding: "20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12, margin: "16px 0" }}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>{label}</div><div>AdSense slot: {slot} — add your pub-ID to activate</div></div>;

const ArticleCard = ({ article, variant = "default", index = 0 }) => {
  const { setPage, categories } = useApp();
  const cat = categories?.find(c => c.id === article.category);
  if (variant === "featured") return <article onClick={() => setPage({ name: "article", id: article.id })} className="anim-in" style={{ cursor: "pointer", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)", transition: "var(--transition)", animationDelay: `${index * .1}s`, animationFillMode: "backwards", display: "grid", gridTemplateColumns: "1fr 1fr" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}><div style={{ aspectRatio: "16/10", background: `url(${article.coverImage}) center/cover`, minHeight: 240 }} /><div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>{cat && <Badge text={`${cat.icon} ${cat.name}`} color={cat.color} />}<h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(1.25rem,2vw,1.75rem)", lineHeight: 1.3, margin: "12px 0", color: "var(--text-primary)" }}>{article.title}</h2><p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.excerpt}</p><div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "var(--text-tertiary)" }}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><I n="clock" s={14} /> {article.readTime} min</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><I n="eye" s={14} /> {article.views?.toLocaleString()}</span><span>{formatDate(article.publishedAt)}</span></div></div></article>;
  return <article onClick={() => setPage({ name: "article", id: article.id })} className="anim-in" style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", cursor: "pointer", transition: "var(--transition)", animationDelay: `${index * .08}s`, animationFillMode: "backwards" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}>{article.coverImage && <div style={{ aspectRatio: "16/9", background: `url(${article.coverImage}) center/cover`, position: "relative" }}>{cat && <span style={{ position: "absolute", top: 12, left: 12, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{cat.icon} {cat.name}</span>}</div>}<div style={{ padding: "20px 20px 18px" }}><h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.125rem", lineHeight: 1.35, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.title}</h3><p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{article.excerpt}</p><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-tertiary)" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ display: "flex", alignItems: "center", gap: 3 }}><I n="clock" s={13} /> {article.readTime}m</span><span style={{ display: "flex", alignItems: "center", gap: 3 }}><I n="heart" s={13} /> {article.likes || 0}</span></div><span>{formatDate(article.publishedAt)}</span></div></div></article>;
};

const Header = () => {
  const { currentUser, setPage, page, theme, toggleTheme, logout, categories } = useApp();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ,    setSearchQ]    = useState("");
  const [userMenu,   setUserMenu]   = useState(false);
  const doSearch = (e) => { e.preventDefault(); if (searchQ.trim()) { setPage({ name: "search", query: searchQ.trim() }); setSearchOpen(false); setSearchQ(""); } };
  const dd = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", border: "none", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "var(--text-primary)", textAlign: "left" };
  return <>
    <header style={{ position: "sticky", top: 0, zIndex: 100, height: "var(--header-height)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(20px)", backgroundColor: "color-mix(in srgb, var(--bg-primary) 85%, transparent)" }}>
      <div className="container" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setPage({ name: "home" })}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>J</div>
          <div><span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", display: "block", lineHeight: 1.1 }}>The Jaaga Desk</span><span className="hide-m" style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".1em" }}>Stories that illuminate</span></div>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {["Home", "Categories", "Trending", "About"].map(item => <button key={item} onClick={() => setPage({ name: item.toLowerCase() })} className="hide-m" style={{ padding: "8px 14px", border: "none", borderRadius: "var(--radius-sm)", background: page.name === item.toLowerCase() ? "var(--accent-light)" : "transparent", color: page.name === item.toLowerCase() ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>{item}</button>)}
          <div className="hide-m" style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />
          <button onClick={() => setSearchOpen(true)} style={{ padding: 8, border: "none", background: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}><I n="search" s={20} /></button>
          <button onClick={toggleTheme} style={{ padding: 8, border: "none", background: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}><I n={theme === "dark" ? "sun" : "moon"} s={20} /></button>
          {currentUser ? (
            <div style={{ position: "relative" }}>
              <button onClick={() => setUserMenu(!userMenu)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", cursor: "pointer" }}>
                <Avatar src={currentUser.avatar} name={currentUser.displayName} size={28} fs={12} />
                <span className="hide-m" style={{ fontSize: 14, fontWeight: 500 }}>{currentUser.displayName}</span>
                <I n="chevDown" s={14} />
              </button>
              {userMenu && <><div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setUserMenu(false)} /><div style={{ position: "absolute", right: 0, top: "calc(100%+8px)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", minWidth: 200, padding: 4, zIndex: 51, animation: "slideDown .2s ease-out" }}>
                {canDo(currentUser.role, "all") && <button onClick={() => { setPage({ name: "admin" }); setUserMenu(false); }} style={dd}><I n="dash" s={16} /> Dashboard</button>}
                {canDo(currentUser.role, "write") && <button onClick={() => { setPage({ name: "write" }); setUserMenu(false); }} style={dd}><I n="edit" s={16} /> Write Post</button>}
                <button onClick={() => { setPage({ name: "profile" }); setUserMenu(false); }} style={dd}><I n="user" s={16} /> My Profile</button>
                <button onClick={() => { setPage({ name: "bookmarks" }); setUserMenu(false); }} style={dd}><I n="bookmark" s={16} /> Bookmarks</button>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <button onClick={() => { logout(); setUserMenu(false); }} style={{ ...dd, color: "#ef4444" }}><I n="logout" s={16} /> Sign Out</button>
              </div></>}
            </div>
          ) : <button onClick={() => setPage({ name: "login" })} style={{ padding: "8px 20px", border: "none", borderRadius: "var(--radius-xl)", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Sign In</button>}
          <button onClick={() => setMenuOpen(true)} style={{ padding: 8, border: "none", background: "none", color: "var(--text-secondary)", cursor: "pointer", display: "none" }} className="mob-menu"><I n="menu" s={24} /></button>
          <style>{`@media(max-width:600px){.mob-menu{display:flex!important}}`}</style>
        </nav>
      </div>
    </header>
    {searchOpen && <Modal onClose={() => setSearchOpen(false)} maxWidth={600}><form onSubmit={doSearch} style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 12 }}><I n="search" s={22} /><input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search articles…" autoFocus style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: 17, color: "var(--text-primary)" }} /></form></Modal>}
    {menuOpen && <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.5)" }} onClick={() => setMenuOpen(false)}><div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(320px,85vw)", background: "var(--bg-card)", padding: 24, animation: "slideIn .3s ease-out", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>Menu</span><button onClick={() => setMenuOpen(false)} style={{ padding: 8, border: "none", background: "none", cursor: "pointer", color: "var(--text-secondary)" }}><I n="close" s={24} /></button></div>{["Home", "Categories", "Trending", "About"].map(item => <button key={item} onClick={() => { setPage({ name: item.toLowerCase() }); setMenuOpen(false); }} style={{ padding: "14px 16px", border: "none", borderRadius: "var(--radius-sm)", background: "none", cursor: "pointer", fontSize: 16, fontWeight: 500, color: "var(--text-primary)", textAlign: "left" }}>{item}</button>)}<div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />{categories?.map(c => <button key={c.id} onClick={() => { setPage({ name: "category", id: c.id }); setMenuOpen(false); }} style={{ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)", textAlign: "left" }}>{c.icon} {c.name}</button>)}</div></div>}
  </>;
};

const Footer = () => {
  const { setPage, categories } = useApp();
  return <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", padding: "48px 0 24px" }}><div className="container"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 32, marginBottom: 40 }}><div><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16 }}>J</div><span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>The Jaaga Desk</span></div><p style={{ fontSize: 14, color: "var(--text-tertiary)", lineHeight: 1.6, maxWidth: 260 }}>Stories that illuminate — rooted in Northern Ghanaian heritage, reaching across the world.</p></div><div><h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-tertiary)" }}>Quick Links</h4>{["Home", "About", "Trending", "Categories"].map(item => <div key={item} onClick={() => setPage({ name: item.toLowerCase() })} style={{ cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, padding: "6px 0" }}>{item}</div>)}</div><div><h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-tertiary)" }}>Topics</h4>{categories?.slice(0, 6).map(c => <div key={c.id} onClick={() => setPage({ name: "category", id: c.id })} style={{ cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, padding: "6px 0" }}>{c.icon} {c.name}</div>)}</div><div><h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-tertiary)" }}>Newsletter</h4><p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>Weekly updates delivered to your inbox.</p><NewsletterSection variant="minimal" /></div></div><div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: 13, color: "var(--text-tertiary)" }}><span>© 2026 The Jaaga Desk. All rights reserved.</span><div style={{ display: "flex", gap: 20 }}><a href="https://www.freeprivacypolicy.com/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-tertiary)" }}>Privacy Policy</a><span onClick={() => setPage({ name: "about" })} style={{ cursor: "pointer" }}>Contact</span></div></div></div></footer>;
};

const BackToTop = () => {
  const [v, setV] = useState(false);
  useEffect(() => { const fn = () => setV(window.scrollY > 400); window.addEventListener("scroll", fn); return () => window.removeEventListener("scroll", fn); }, []);
  return <button className={`back-to-top ${v ? "visible" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><I n="arrowUp" s={20} /></button>;
};

// ─── ICONS ─────────────────────────────────────────────────────────────────────

const I = ({ n, s = 20, style: sx = {} }) => {
  const d = { home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z", search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", comment: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", bookmark: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z", share: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z", clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z", eyeOff: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21", edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16", plus: "M12 4v16m8-8H4", close: "M6 18L18 6M6 6l12 12", menu: "M4 6h16M4 12h16M4 18h16", chevDown: "M19 9l-7 7-7-7", chevRight: "M9 5l7 7-7 7", mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", dash: "M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm10-2a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z", image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z", trend: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1", sun: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z", moon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z", fire: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z", globe: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9", arrowUp: "M5 10l7-7m0 0l7 7m-7-7v18", camera: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z", lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", database: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" };
  const paths = n === "eye" ? <><path d={d.eye} /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></> : <path d={d[n] || "M12 12"} />;
  return <svg xmlns="http://www.w3.org/2000/svg" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...sx }}>{paths}</svg>;
};

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Source+Sans+3:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
    :root { --bg-primary:#faf9f7; --bg-secondary:#f0eee9; --bg-card:#fff; --bg-elevated:#fff; --text-primary:#1a1a1a; --text-secondary:#5a5a5a; --text-tertiary:#8a8a8a; --accent:#c45d3e; --accent-hover:#a84d32; --accent-light:rgba(196,93,62,.08); --accent-secondary:#2d6a4f; --border:#e5e2dc; --border-light:#f0eee9; --shadow-sm:0 1px 3px rgba(0,0,0,.04); --shadow-md:0 4px 12px rgba(0,0,0,.06); --shadow-lg:0 8px 30px rgba(0,0,0,.08); --shadow-xl:0 20px 60px rgba(0,0,0,.1); --radius-sm:6px; --radius-md:10px; --radius-lg:16px; --radius-xl:24px; --font-display:'Playfair Display',Georgia,serif; --font-body:'Source Sans 3','Segoe UI',sans-serif; --font-mono:'JetBrains Mono',monospace; --max-width:1280px; --header-height:72px; --transition:.2s cubic-bezier(.4,0,.2,1); }
    [data-theme="dark"] { --bg-primary:#111110; --bg-secondary:#1a1918; --bg-card:#1e1d1c; --bg-elevated:#252423; --text-primary:#ede9e3; --text-secondary:#a8a29e; --text-tertiary:#78716c; --accent:#e07a5f; --accent-hover:#e8927a; --accent-light:rgba(224,122,95,.1); --border:#2e2c2a; --border-light:#252423; --shadow-sm:0 1px 3px rgba(0,0,0,.2); --shadow-md:0 4px 12px rgba(0,0,0,.3); --shadow-lg:0 8px 30px rgba(0,0,0,.4); --shadow-xl:0 20px 60px rgba(0,0,0,.5); }
    *{margin:0;padding:0;box-sizing:border-box} body,html{font-family:var(--font-body);background:var(--bg-primary);color:var(--text-primary);-webkit-font-smoothing:antialiased;line-height:1.6} ::selection{background:var(--accent);color:#fff} input,textarea,select,button{font-family:inherit;font-size:inherit} a{color:inherit;text-decoration:none}
    .container{max-width:var(--max-width);margin:0 auto;padding:0 24px}
    @media(max-width:768px){.container{padding:0 16px} :root{--header-height:60px}} @media(max-width:900px){.hide-m{display:none!important} .main-grid{grid-template-columns:1fr!important}}
    ::-webkit-scrollbar{width:8px} ::-webkit-scrollbar-track{background:var(--bg-secondary)} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
    @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes fadeInUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}} @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}} @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
    .anim-in{animation:fadeIn .4s ease-out forwards} .anim-up{animation:fadeInUp .5s ease-out forwards}
    .md-h2{font-family:var(--font-display);font-size:1.5rem;font-weight:700;margin:2em 0 .75em;color:var(--text-primary)} .md-h3{font-family:var(--font-display);font-size:1.25rem;font-weight:700;margin:1.5em 0 .5em;color:var(--text-primary)}
    .article-body p{margin:1em 0;line-height:1.85;font-size:1.125rem;color:var(--text-secondary)} .article-body li{color:var(--text-secondary);font-size:1.125rem;line-height:1.85;margin:.25em 0 .25em 1.5em;list-style:disc} .article-body strong{color:var(--text-primary)}
    .back-to-top{position:fixed;bottom:32px;right:32px;z-index:100;width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-lg);transition:var(--transition);opacity:0;pointer-events:none;transform:translateY(8px)} .back-to-top.visible{opacity:1;pointer-events:auto;transform:translateY(0)}
  `}</style>
);
