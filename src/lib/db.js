// ═══════════════════════════════════════════════════════════════════════════
// src/lib/db.js
// THE JAAGA DESK — Complete Database API Layer
//
// This file REPLACES the old localStorage DB object entirely.
// Every function here talks to Firebase Firestore.
// Your React components call these functions exactly like before —
// nothing else in your app needs to change except importing from here.
//
// COLLECTIONS IN FIRESTORE:
//   posts/          — blog articles
//   users/          — registered user profiles
//   comments/       — comments on posts
//   subscribers/    — newsletter subscribers
//   activity/       — admin activity log
//   categories/     — topic categories (rarely changes)
//   likes/          — tracks who liked what (prevents double-liking)
//   bookmarks/      — per-user saved articles
// ═══════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";

import { db, auth } from "./firebase";
import { uploadImage } from "./cloudinary";

// ─── UTILITY ────────────────────────────────────────────────────────────────

// Convert Firestore Timestamps to ISO strings for consistent date handling
const stampToISO = (data) => {
  if (!data) return data;
  const result = { ...data };
  for (const key of Object.keys(result)) {
    if (result[key] instanceof Timestamp) {
      result[key] = result[key].toDate().toISOString();
    }
  }
  return result;
};

// Generate a URL-safe slug from a title
export const slugify = (t) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Calculate read time in minutes
export const calcReadTime = (text) =>
  Math.max(1, Math.ceil((text?.split(/\s+/).length || 0) / 200));


// ═══════════════════════════════════════════════════════════════════════════
// AUTH — Sign up, Sign in, Sign out, Password change
// ═══════════════════════════════════════════════════════════════════════════

export const AuthAPI = {
  // Register a new user
  // Creates a Firebase Auth account AND a Firestore user document
  async register({ email, password, username, displayName }) {
    // Step 1: Create Firebase Auth account
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const userDoc = {
      uid,
      username:    username || email.split("@")[0],
      displayName: displayName || email.split("@")[0],
      email,
      role:        "reader",
      bio:         "",
      avatar:      null,
      verified:    true,
      joinedAt:    serverTimestamp(),
      lastLogin:   serverTimestamp(),
    };

    // Step 2: Write to Firestore — retry once if it fails
    // (rules require auth token which may take a moment to propagate)
    try {
      await setDoc(doc(db, "users", uid), userDoc);
    } catch (firstErr) {
      // Wait 1 second for auth token to propagate, then retry
      await new Promise(r => setTimeout(r, 1000));
      try {
        await setDoc(doc(db, "users", uid), userDoc);
      } catch (secondErr) {
        // Log but don't throw — Auth account is created, user can still log in
        // The missing Firestore doc will be created on next login
        console.warn("Firestore user doc write failed (will retry on login):", secondErr.message);
      }
    }

    return { uid, ...userDoc };
  },

  // Sign in with email or username + password
  async login({ usernameOrEmail, password }) {
    let email = usernameOrEmail;

    // If they typed a username (no @), look up their email first
    if (!usernameOrEmail.includes("@")) {
      const snap = await getDocs(
        query(collection(db, "users"), where("username", "==", usernameOrEmail))
      );
      if (snap.empty) throw new Error("User not found");
      email = snap.docs[0].data().email;
    }

    // Firebase Auth sign in
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Check if Firestore user document exists
    let userSnap = await getDoc(doc(db, "users", uid));

    // If the user exists in Auth but not Firestore (can happen if registration
    // Firestore write failed), create the missing document now
    if (!userSnap.exists()) {
      const fallbackDoc = {
        uid,
        username:    email.split("@")[0],
        displayName: cred.user.displayName || email.split("@")[0],
        email,
        role:        "reader",
        bio:         "",
        avatar:      null,
        verified:    true,
        joinedAt:    serverTimestamp(),
        lastLogin:   serverTimestamp(),
      };
      await setDoc(doc(db, "users", uid), fallbackDoc);
      return { uid, ...fallbackDoc };
    }

    // Update lastLogin
    await updateDoc(doc(db, "users", uid), { lastLogin: serverTimestamp() });

    // Re-read with updated timestamp
    userSnap = await getDoc(doc(db, "users", uid));
    return stampToISO({ uid, ...userSnap.data() });
  },

  // Sign out
  async logout() {
    await signOut(auth);
  },

  // Listen to auth state changes (call this once on app mount)
  // Returns an unsubscribe function
  onAuthChange(callback) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) {
            callback(stampToISO({ uid: firebaseUser.uid, ...snap.data() }));
          } else {
            // Auth user exists but no Firestore doc — create it automatically
            const fallbackDoc = {
              uid:         firebaseUser.uid,
              username:    firebaseUser.email.split("@")[0],
              displayName: firebaseUser.displayName || firebaseUser.email.split("@")[0],
              email:       firebaseUser.email,
              role:        "reader",
              bio:         "",
              avatar:      null,
              verified:    true,
              joinedAt:    serverTimestamp(),
              lastLogin:   serverTimestamp(),
            };
            await setDoc(doc(db, "users", firebaseUser.uid), fallbackDoc);
            callback({ uid: firebaseUser.uid, ...fallbackDoc });
          }
        } catch (err) {
          // If we can't reach Firestore, still mark auth as resolved
          console.warn("Could not load user profile:", err.message);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },

  // Change password (requires current password for security)
  async changePassword({ currentPassword, newPassword }) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");

    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  },

  // Resend verification email
  async resendVerification() {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// USERS — Profile management, role assignment
// ═══════════════════════════════════════════════════════════════════════════

export const UsersAPI = {
  // Get a single user by their UID
  async get(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return stampToISO({ uid: snap.id, ...snap.data() });
  },

  // Get ALL users (admin only — called in admin dashboard)
  async getAll() {
    const snap = await getDocs(
      query(collection(db, "users"), orderBy("joinedAt", "desc"))
    );
    return snap.docs.map(d => stampToISO({ uid: d.id, ...d.data() }));
  },

  // Update a user's own profile (displayName, bio, etc.)
  async updateProfile(uid, updates) {
    const allowed = ["displayName", "bio", "username"];
    const safe = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );
    await updateDoc(doc(db, "users", uid), safe);
    return safe;
  },

  // Upload avatar image via Cloudinary (free, no credit card needed)
  async uploadAvatar(uid, dataUrl) {
    const downloadURL = await uploadImage(dataUrl, "jaaga/avatars");
    await updateDoc(doc(db, "users", uid), { avatar: downloadURL });
    return downloadURL;
  },

  // Admin: change a user's role
  async setRole(uid, role) {
    const validRoles = ["admin", "editor", "author", "reader"];
    if (!validRoles.includes(role)) throw new Error("Invalid role");
    await updateDoc(doc(db, "users", uid), { role });
  },

  // Mark user as email-verified (called after Firebase email link is clicked)
  async markVerified(uid) {
    await updateDoc(doc(db, "users", uid), { verified: true });
  },

  // Real-time listener for a single user (keeps profile in sync)
  onUserChange(uid, callback) {
    return onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) callback(stampToISO({ uid: snap.id, ...snap.data() }));
    });
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// POSTS — Create, read, update, delete articles
// ═══════════════════════════════════════════════════════════════════════════

export const PostsAPI = {
  // Fetch all published posts (for homepage / public feed)
  async getPublished({ limitTo = 50, categoryId = null } = {}) {
    let q = query(
      collection(db, "posts"),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
      limit(limitTo)
    );
    if (categoryId) {
      q = query(
        collection(db, "posts"),
        where("status", "==", "published"),
        where("category", "==", categoryId),
        orderBy("publishedAt", "desc"),
        limit(limitTo)
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  // Fetch ALL posts including drafts (admin/editor only)
  async getAll() {
    const snap = await getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  // Get a single post by its Firestore ID
  async getById(postId) {
    const snap = await getDoc(doc(db, "posts", postId));
    if (!snap.exists()) return null;
    return stampToISO({ id: snap.id, ...snap.data() });
  },

  // Get a single post by its URL slug (for clean URLs like /future-of-ai-2026)
  async getBySlug(slug) {
    const snap = await getDocs(
      query(collection(db, "posts"), where("slug", "==", slug))
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    return stampToISO({ id: d.id, ...d.data() });
  },

  // Get trending posts (most viewed)
  async getTrending(limitTo = 10) {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("status", "==", "published"),
        orderBy("views", "desc"),
        limit(limitTo)
      )
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  // Get featured posts (for homepage hero)
  async getFeatured() {
    const snap = await getDocs(
      query(
        collection(db, "posts"),
        where("status", "==", "published"),
        where("featured", "==", true),
        orderBy("publishedAt", "desc"),
        limit(4)
      )
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  // Search posts by title/tag keywords (basic text search)
  // For production full-text search, integrate Algolia — see README
  async search(term) {
    const all = await this.getPublished({ limitTo: 200 });
    const t = term.toLowerCase();
    return all.filter(
      p =>
        p.title?.toLowerCase().includes(t) ||
        p.excerpt?.toLowerCase().includes(t) ||
        p.tags?.some(tag => tag.toLowerCase().includes(t))
    );
  },

  // Create a new post
  async create({ title, content, excerpt, category, tags, coverImage, status, featured, authorUid, authorName, articleLength }) {
    const now = new Date().toISOString();
    const postData = {
      title:       title.trim(),
      slug:        slugify(title),
      content:     content.trim(),
      excerpt:     excerpt?.trim() || content.trim().substring(0, 160) + "...",
      category:    category || "tech",
      tags:        tags || [],
      coverImage:  coverImage || "",
      status:      status || "draft",
      featured:    featured || false,
      articleLength: articleLength || "standard",  // "short", "standard", or "long"
      author:      authorUid,
      authorName,
      readTime:    calcReadTime(content),
      views:       0,
      likes:       0,
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
      publishedAt: status === "published" ? serverTimestamp() : null,
    };
    const ref = await addDoc(collection(db, "posts"), postData);
    await ActivityAPI.log("post_created", `"${title}" published by ${authorName}`);
    return { id: ref.id, ...postData, createdAt: now, updatedAt: now };
  },

  // Update an existing post
  async update(postId, updates) {
    const allowed = ["title", "slug", "content", "excerpt", "category", "tags", "coverImage", "status", "featured", "readTime", "articleLength"];
    const safe = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );
    safe.updatedAt = serverTimestamp();
    if (updates.title) safe.slug = slugify(updates.title);
    if (updates.content) safe.readTime = calcReadTime(updates.content);
    if (updates.status === "published") {
      const existing = await getDoc(doc(db, "posts", postId));
      if (!existing.data()?.publishedAt) {
        safe.publishedAt = serverTimestamp();
      }
    }
    await updateDoc(doc(db, "posts", postId), safe);
    await ActivityAPI.log("post_updated", `Post ${postId} updated`);
    return safe;
  },

  // Delete a post and all its comments
  async delete(postId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "posts", postId));

    // Delete all comments for this post
    const commentsSnap = await getDocs(
      query(collection(db, "comments"), where("postId", "==", postId))
    );
    commentsSnap.docs.forEach(d => batch.delete(d.ref));

    // Delete all likes for this post
    const likesSnap = await getDocs(
      query(collection(db, "likes"), where("postId", "==", postId))
    );
    likesSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
    await ActivityAPI.log("post_deleted", `Post ${postId} deleted`);
  },

  // Increment view count (called every time someone opens an article)
  async incrementViews(postId) {
    await updateDoc(doc(db, "posts", postId), {
      views: increment(1),
    });
  },

  // Upload a cover image via Cloudinary (free, no credit card needed)
  async uploadCoverImage(postId, dataUrl) {
    const downloadURL = await uploadImage(dataUrl, "jaaga/covers");
    await updateDoc(doc(db, "posts", postId), { coverImage: downloadURL });
    return downloadURL;
  },

  // Real-time listener: fires callback whenever published posts change
  // Returns unsubscribe function
  onPublishedChange(callback) {
    return onSnapshot(
      query(
        collection(db, "posts"),
        where("status", "==", "published"),
        orderBy("publishedAt", "desc"),
        limit(50)
      ),
      (snap) => {
        const posts = snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
        callback(posts);
      },
      (error) => {
        // If the real-time listener fails (missing index, permission, etc.),
        // fall back to a one-time fetch so guests still see content
        console.warn("onSnapshot failed, falling back to getPublished:", error.message);
        getDocs(
          query(
            collection(db, "posts"),
            where("status", "==", "published"),
            orderBy("publishedAt", "desc"),
            limit(50)
          )
        ).then(snap => {
          callback(snap.docs.map(d => stampToISO({ id: d.id, ...d.data() })));
        }).catch(() => {
          // Last resort: fetch ALL posts without ordering (no index needed)
          getDocs(collection(db, "posts")).then(snap => {
            const posts = snap.docs
              .map(d => stampToISO({ id: d.id, ...d.data() }))
              .filter(p => p.status === "published")
              .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
            callback(posts);
          }).catch(err => {
            console.error("All post fetch methods failed:", err.message);
            callback([]);
          });
        });
      }
    );
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// LIKES — Toggle likes, check if user liked a post
// ═══════════════════════════════════════════════════════════════════════════

export const LikesAPI = {
  // Toggle like on/off. Returns { liked: boolean, newCount: number }
  async toggle(postId, uid) {
    const likeId = `${postId}_${uid}`;
    const likeRef = doc(db, "likes", likeId);
    const likeSnap = await getDoc(likeRef);

    const batch = writeBatch(db);

    if (likeSnap.exists()) {
      // Unlike
      batch.delete(likeRef);
      batch.update(doc(db, "posts", postId), { likes: increment(-1) });
      await batch.commit();
      return { liked: false };
    } else {
      // Like
      batch.set(likeRef, { postId, uid, createdAt: serverTimestamp() });
      batch.update(doc(db, "posts", postId), { likes: increment(1) });
      await batch.commit();
      return { liked: true };
    }
  },

  // Check if a specific user already liked a specific post
  async hasLiked(postId, uid) {
    const snap = await getDoc(doc(db, "likes", `${postId}_${uid}`));
    return snap.exists();
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// BOOKMARKS — Save/unsave articles per user
// ═══════════════════════════════════════════════════════════════════════════

export const BookmarksAPI = {
  // Get all bookmarked post IDs for a user
  async getForUser(uid) {
    const snap = await getDoc(doc(db, "bookmarks", uid));
    return snap.exists() ? snap.data().postIds || [] : [];
  },

  // Toggle bookmark on/off
  async toggle(uid, postId) {
    const ref = doc(db, "bookmarks", uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data().postIds || [] : [];

    if (existing.includes(postId)) {
      await setDoc(ref, { postIds: arrayRemove(postId) }, { merge: true });
      return { bookmarked: false };
    } else {
      await setDoc(ref, { postIds: arrayUnion(postId) }, { merge: true });
      return { bookmarked: true };
    }
  },

  // Check if a post is bookmarked by a user
  async isBookmarked(uid, postId) {
    const snap = await getDoc(doc(db, "bookmarks", uid));
    return snap.exists() && (snap.data().postIds || []).includes(postId);
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// COMMENTS — Post, fetch, delete, real-time listening
// ═══════════════════════════════════════════════════════════════════════════

export const CommentsAPI = {
  // Get all comments for a specific post
  async getForPost(postId) {
    const snap = await getDocs(
      query(
        collection(db, "comments"),
        where("postId", "==", postId),
        orderBy("createdAt", "desc")
      )
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  // Get all comments across all posts (for admin dashboard)
  async getAll(limitTo = 100) {
    const snap = await getDocs(
      query(
        collection(db, "comments"),
        orderBy("createdAt", "desc"),
        limit(limitTo)
      )
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  // Post a new comment
  async create({ postId, authorUid, authorName, content, isGuest = false }) {
    const commentData = {
      postId,
      author:     authorUid || "guest",
      authorName: authorName.trim(),
      content:    content.trim(),
      isGuest,
      approved:   true,  // Set to false if you want pre-moderation
      createdAt:  serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "comments"), commentData);
    await ActivityAPI.log("comment_posted", `${authorName} commented on post ${postId}`);
    return { id: ref.id, ...commentData, createdAt: new Date().toISOString() };
  },

  // Delete a comment (admin/moderator only)
  async delete(commentId) {
    await deleteDoc(doc(db, "comments", commentId));
    await ActivityAPI.log("comment_deleted", `Comment ${commentId} removed`);
  },

  // Real-time listener for comments on a post
  onPostCommentsChange(postId, callback) {
    return onSnapshot(
      query(
        collection(db, "comments"),
        where("postId", "==", postId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const comments = snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
        callback(comments);
      },
      (error) => {
        // If onSnapshot fails (missing composite index, permissions, etc.),
        // fall back to a one-time fetch
        console.warn("Comments onSnapshot failed, falling back to getDocs:", error.message);
        getDocs(
          query(
            collection(db, "comments"),
            where("postId", "==", postId),
            orderBy("createdAt", "desc")
          )
        ).then(snap => {
          callback(snap.docs.map(d => stampToISO({ id: d.id, ...d.data() })));
        }).catch(() => {
          // Last resort: fetch without ordering (no composite index needed)
          getDocs(
            query(collection(db, "comments"), where("postId", "==", postId))
          ).then(snap => {
            const comments = snap.docs
              .map(d => stampToISO({ id: d.id, ...d.data() }))
              .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            callback(comments);
          }).catch(err => {
            console.error("All comment fetch methods failed:", err.message);
            callback([]);
          });
        });
      }
    );
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES — Static topic categories
// ═══════════════════════════════════════════════════════════════════════════

export const CategoriesAPI = {
  // Get all categories
  async getAll() {
    const snap = await getDocs(collection(db, "categories"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Seed the default categories if none exist yet.
  // Safe to call on every page load — checks first before writing.
  async seed() {
    try {
      const existing = await getDocs(collection(db, "categories"));
      if (!existing.empty) return; // already seeded, do nothing

      const defaults = [
        { id: "tech",      name: "Technology",     icon: "💻", color: "#0ea5e9", description: "Latest in tech, AI, and innovation" },
        { id: "lifestyle", name: "Lifestyle",       icon: "🌿", color: "#10b981", description: "Living well, productivity, and growth" },
        { id: "business",  name: "Business",        icon: "📊", color: "#8b5cf6", description: "Strategy, entrepreneurship, and markets" },
        { id: "culture",   name: "Culture",         icon: "🎭", color: "#f59e0b", description: "Arts, traditions, and society" },
        { id: "science",   name: "Science",         icon: "🔬", color: "#ef4444", description: "Discoveries, research, and breakthroughs" },
        { id: "travel",    name: "Travel",          icon: "✈️", color: "#06b6d4", description: "Adventures, destinations, and guides" },
        { id: "food",      name: "Food & Recipes",  icon: "🍳", color: "#ec4899", description: "Cooking, nutrition, and culinary arts" },
        { id: "opinion",   name: "Opinion",         icon: "💬", color: "#6366f1", description: "Perspectives, analysis, and commentary" },
      ];

      const batch = writeBatch(db);
      defaults.forEach(cat => batch.set(doc(db, "categories", cat.id), cat));
      await batch.commit();
      console.log("Categories seeded successfully.");
    } catch (err) {
      // If seeding fails (e.g. not signed in), silently ignore.
      // Categories will be seeded when an admin signs in.
      console.warn("Category seed skipped:", err.message);
    }
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIBERS — Newsletter signups
// ═══════════════════════════════════════════════════════════════════════════

export const SubscribersAPI = {
  // Subscribe an email address
  async subscribe(email) {
    const normalised = email.toLowerCase().trim();
    const ref = doc(db, "subscribers", normalised);
    const existing = await getDoc(ref);

    if (existing.exists() && existing.data().verified) {
      throw new Error("already_subscribed");
    }

    // Mark as verified immediately (no Cloud Function needed)
    // When you deploy Cloud Functions later, remove verified:true and let the
    // email trigger handle it
    await setDoc(ref, {
      email:        normalised,
      verified:     true,
      subscribedAt: serverTimestamp(),
      verifiedAt:   serverTimestamp(),
    });

    return { email: normalised };
  },

  // Mark subscriber as verified (called by your Cloud Function after email click)
  async verify(email) {
    await updateDoc(doc(db, "subscribers", email.toLowerCase()), {
      verified:   true,
      verifiedAt: serverTimestamp(),
    });
  },

  // Get all subscribers (admin only)
  async getAll() {
    const snap = await getDocs(
      query(collection(db, "subscribers"), orderBy("subscribedAt", "desc"))
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  // Remove a subscriber (admin only)
  async remove(email) {
    await deleteDoc(doc(db, "subscribers", email.toLowerCase()));
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY — Admin event log
// ═══════════════════════════════════════════════════════════════════════════

export const ActivityAPI = {
  // Log an action (called internally by other API functions)
  async log(action, details) {
    await addDoc(collection(db, "activity"), {
      action,
      details,
      timestamp: serverTimestamp(),
    });
  },

  // Get recent activity (admin dashboard)
  async getRecent(limitTo = 50) {
    const snap = await getDocs(
      query(
        collection(db, "activity"),
        orderBy("timestamp", "desc"),
        limit(limitTo)
      )
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// READING HISTORY — Track which articles a logged-in user has read
// ═══════════════════════════════════════════════════════════════════════════

export const HistoryAPI = {
  async addRead(uid, postId) {
    const ref = doc(db, "readHistory", uid);
    await setDoc(
      ref,
      { postIds: arrayUnion(postId), updatedAt: serverTimestamp() },
      { merge: true }
    );
  },

  async getForUser(uid) {
    const snap = await getDoc(doc(db, "readHistory", uid));
    return snap.exists() ? snap.data().postIds || [] : [];
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT — grouped for convenience
// ═══════════════════════════════════════════════════════════════════════════

export default {
  auth:        AuthAPI,
  users:       UsersAPI,
  posts:       PostsAPI,
  likes:       LikesAPI,
  bookmarks:   BookmarksAPI,
  comments:    CommentsAPI,
  categories:  CategoriesAPI,
  subscribers: SubscribersAPI,
  activity:    ActivityAPI,
  history:     HistoryAPI,
};
