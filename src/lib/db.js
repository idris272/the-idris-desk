// ═══════════════════════════════════════════════════════════════════════════
// src/lib/db.js
// THE JAAGA DESK — Complete Database API Layer
//
// CHANGES FROM PREVIOUS VERSION:
//   • AuthAPI.login: session timeout stored in localStorage (30-day expiry)
//   • AuthAPI.onAuthChange: auto-logout if session has expired
//   • CommentsAPI.create: ActivityAPI.log is now fire-and-forget (won't throw)
//   • CommentsAPI: added reply(), toggleReaction() for likes/dislikes on comments
//   • CommentsAPI: replies stored as sub-collection comments/{id}/replies
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

export const slugify = (t) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const calcReadTime = (text) =>
  Math.max(1, Math.ceil((text?.split(/\s+/).length || 0) / 200));

// ─── SESSION HELPERS ─────────────────────────────────────────────────────────
// We store a session expiry timestamp in localStorage.
// Default: 30 days. Adjust SESSION_DURATION_MS to change.

const SESSION_KEY = "jd:sessionExpiry";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function setSessionExpiry() {
  const expiry = Date.now() + SESSION_DURATION_MS;
  localStorage.setItem(SESSION_KEY, String(expiry));
}

function isSessionExpired() {
  const expiry = localStorage.getItem(SESSION_KEY);
  if (!expiry) return false; // No session stored → grant access, will be stamped on next login
  return Date.now() > Number(expiry);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}


// ═══════════════════════════════════════════════════════════════════════════
// AUTH — Sign up, Sign in, Sign out, Password change
// ═══════════════════════════════════════════════════════════════════════════

export const AuthAPI = {
  async register({ email, password, username, displayName }) {
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

    // Set session expiry NOW so onAuthChange does not immediately sign them out
    setSessionExpiry();

    try {
      await setDoc(doc(db, "users", uid), userDoc);
    } catch (firstErr) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        await setDoc(doc(db, "users", uid), userDoc);
      } catch (secondErr) {
        console.warn("Firestore user doc write failed (will retry on login):", secondErr.message);
      }
    }

    return { uid, ...userDoc };
  },

  async login({ usernameOrEmail, password }) {
    let email = usernameOrEmail;

    if (!usernameOrEmail.includes("@")) {
      const snap = await getDocs(
        query(collection(db, "users"), where("username", "==", usernameOrEmail))
      );
      if (snap.empty) throw new Error("User not found");
      email = snap.docs[0].data().email;
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // ── Set session expiry on successful login ──────────────────────────
    setSessionExpiry();

    let userSnap = await getDoc(doc(db, "users", uid));

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

    await updateDoc(doc(db, "users", uid), { lastLogin: serverTimestamp() });
    userSnap = await getDoc(doc(db, "users", uid));
    return stampToISO({ uid, ...userSnap.data() });
  },

  async logout() {
    clearSession();
    await signOut(auth);
  },

  onAuthChange(callback) {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // ── Check session expiry ─────────────────────────────────────────
        if (isSessionExpired()) {
          console.log("Session expired — signing out automatically");
          clearSession();
          await signOut(auth);
          callback(null);
          return;
        }

        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) {
            callback(stampToISO({ uid: firebaseUser.uid, ...snap.data() }));
          } else {
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
          console.warn("Could not load user profile:", err.message);
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },

  async changePassword({ currentPassword, newPassword }) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  },

  async resendVerification() {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// USERS — Profile management, role assignment
// ═══════════════════════════════════════════════════════════════════════════

export const UsersAPI = {
  async get(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return stampToISO({ uid: snap.id, ...snap.data() });
  },

  async getAll() {
    const snap = await getDocs(
      query(collection(db, "users"), orderBy("joinedAt", "desc"))
    );
    return snap.docs.map(d => stampToISO({ uid: d.id, ...d.data() }));
  },

  async updateProfile(uid, updates) {
    const allowed = ["displayName", "bio", "username"];
    const safe = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );
    await updateDoc(doc(db, "users", uid), safe);
    return safe;
  },

  async uploadAvatar(uid, dataUrl) {
    const downloadURL = await uploadImage(dataUrl, "jaaga/avatars");
    await updateDoc(doc(db, "users", uid), { avatar: downloadURL });
    return downloadURL;
  },

  async setRole(uid, role) {
    const validRoles = ["admin", "editor", "author", "reader"];
    if (!validRoles.includes(role)) throw new Error("Invalid role");
    await updateDoc(doc(db, "users", uid), { role });
  },

  async markVerified(uid) {
    await updateDoc(doc(db, "users", uid), { verified: true });
  },

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

  async getAll() {
    const snap = await getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  async getById(postId) {
    const snap = await getDoc(doc(db, "posts", postId));
    if (!snap.exists()) return null;
    return stampToISO({ id: snap.id, ...snap.data() });
  },

  async getBySlug(slug) {
    const snap = await getDocs(
      query(collection(db, "posts"), where("slug", "==", slug))
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    return stampToISO({ id: d.id, ...d.data() });
  },

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
      articleLength: articleLength || "standard",
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
    ActivityAPI.log("post_created", `"${title}" published by ${authorName}`).catch(() => {});
    return { id: ref.id, ...postData, createdAt: now, updatedAt: now };
  },

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
    ActivityAPI.log("post_updated", `Post ${postId} updated`).catch(() => {});
    return safe;
  },

  async delete(postId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "posts", postId));

    const commentsSnap = await getDocs(
      query(collection(db, "comments"), where("postId", "==", postId))
    );
    commentsSnap.docs.forEach(d => batch.delete(d.ref));

    const likesSnap = await getDocs(
      query(collection(db, "likes"), where("postId", "==", postId))
    );
    likesSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
    ActivityAPI.log("post_deleted", `Post ${postId} deleted`).catch(() => {});
  },

  async incrementViews(postId) {
    await updateDoc(doc(db, "posts", postId), {
      views: increment(1),
    });
  },

  async uploadCoverImage(postId, dataUrl) {
    const downloadURL = await uploadImage(dataUrl, "jaaga/covers");
    await updateDoc(doc(db, "posts", postId), { coverImage: downloadURL });
    return downloadURL;
  },

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
  async toggle(postId, uid) {
    const likeId = `${postId}_${uid}`;
    const likeRef = doc(db, "likes", likeId);
    const likeSnap = await getDoc(likeRef);

    const batch = writeBatch(db);

    if (likeSnap.exists()) {
      batch.delete(likeRef);
      batch.update(doc(db, "posts", postId), { likes: increment(-1) });
      await batch.commit();
      return { liked: false };
    } else {
      batch.set(likeRef, { postId, uid, createdAt: serverTimestamp() });
      batch.update(doc(db, "posts", postId), { likes: increment(1) });
      await batch.commit();
      return { liked: true };
    }
  },

  async hasLiked(postId, uid) {
    const snap = await getDoc(doc(db, "likes", `${postId}_${uid}`));
    return snap.exists();
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// BOOKMARKS — Save/unsave articles per user
// ═══════════════════════════════════════════════════════════════════════════

export const BookmarksAPI = {
  async getForUser(uid) {
    const snap = await getDoc(doc(db, "bookmarks", uid));
    return snap.exists() ? snap.data().postIds || [] : [];
  },

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

  async isBookmarked(uid, postId) {
    const snap = await getDoc(doc(db, "bookmarks", uid));
    return snap.exists() && (snap.data().postIds || []).includes(postId);
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// COMMENTS — Post, fetch, delete, real-time listening
//            + Replies (sub-collection) + Reactions (likes/dislikes)
//
// Firestore structure:
//   comments/{commentId}
//     .postId, .author, .authorName, .content, .isGuest
//     .likes    (number, default 0)
//     .dislikes (number, default 0)
//     .approved, .createdAt
//
//   comments/{commentId}/replies/{replyId}
//     .author, .authorName, .content, .isGuest
//     .likes, .dislikes, .createdAt
//
// Reactions (like/dislike) are stored in:
//   commentReactions/{commentId}_{uid}   → { type: "like"|"dislike", ... }
// ═══════════════════════════════════════════════════════════════════════════

export const CommentsAPI = {
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

  // Post a top-level comment
  // NOTE: ActivityAPI.log is fire-and-forget so guest posts never fail because of it
  async create({ postId, authorUid, authorName, content, isGuest = false }) {
    const commentData = {
      postId,
      author:     authorUid || "guest",
      authorName: authorName.trim(),
      content:    content.trim(),
      isGuest,
      approved:   true,
      likes:      0,
      dislikes:   0,
      createdAt:  serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "comments"), commentData);
    // Fire-and-forget — do NOT await so a permission error here won't
    // make the comment appear to have failed
    ActivityAPI.log("comment_posted", `${authorName} commented on post ${postId}`).catch(() => {});
    return { id: ref.id, ...commentData, createdAt: new Date().toISOString() };
  },

  async delete(commentId) {
    await deleteDoc(doc(db, "comments", commentId));
    ActivityAPI.log("comment_deleted", `Comment ${commentId} removed`).catch(() => {});
  },

  // ── Replies ──────────────────────────────────────────────────────────────

  // Post a reply to a comment
  async reply({ commentId, authorUid, authorName, content, isGuest = false }) {
    const replyData = {
      author:     authorUid || "guest",
      authorName: authorName.trim(),
      content:    content.trim(),
      isGuest,
      likes:      0,
      dislikes:   0,
      createdAt:  serverTimestamp(),
    };
    const ref = await addDoc(
      collection(db, "comments", commentId, "replies"),
      replyData
    );
    return { id: ref.id, ...replyData, createdAt: new Date().toISOString() };
  },

  // Fetch replies for a comment (one-time)
  async getReplies(commentId) {
    const snap = await getDocs(
      query(
        collection(db, "comments", commentId, "replies"),
        orderBy("createdAt", "asc")
      )
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  // Delete a reply
  async deleteReply(commentId, replyId) {
    await deleteDoc(doc(db, "comments", commentId, "replies", replyId));
  },

  // ── Reactions (like / dislike) ────────────────────────────────────────────
  // Works for both top-level comments and replies.
  // targetType: "comment" | "reply"
  // For replies: targetId = replyId, parentId = commentId

  async toggleReaction({ targetType, targetId, parentId = null, uid, reaction }) {
    // reaction: "like" | "dislike"
    const reactionDocId = `${targetId}_${uid}`;
    const reactionRef = doc(db, "commentReactions", reactionDocId);
    const reactionSnap = await getDoc(reactionRef);

    // Determine Firestore path for the target document
    const targetRef = targetType === "reply" && parentId
      ? doc(db, "comments", parentId, "replies", targetId)
      : doc(db, "comments", targetId);

    const batch = writeBatch(db);
    const existing = reactionSnap.exists() ? reactionSnap.data().reaction : null;

    if (existing === reaction) {
      // Same reaction — undo it
      batch.delete(reactionRef);
      batch.update(targetRef, { [reaction === "like" ? "likes" : "dislikes"]: increment(-1) });
      await batch.commit();
      return { reaction: null };
    } else {
      // New reaction or switching
      if (existing) {
        // Remove old reaction count
        batch.update(targetRef, { [existing === "like" ? "likes" : "dislikes"]: increment(-1) });
      }
      // Add new reaction count
      batch.update(targetRef, { [reaction === "like" ? "likes" : "dislikes"]: increment(1) });
      batch.set(reactionRef, { uid, targetId, reaction, createdAt: serverTimestamp() });
      await batch.commit();
      return { reaction };
    }
  },

  // Get the current user's reaction for a list of target IDs
  async getReactions(targetIds, uid) {
    if (!uid || !targetIds.length) return {};
    const results = {};
    await Promise.all(
      targetIds.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "commentReactions", `${id}_${uid}`));
          if (snap.exists()) results[id] = snap.data().reaction;
        } catch (_) {}
      })
    );
    return results;
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
  async getAll() {
    const snap = await getDocs(collection(db, "categories"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async seed() {
    try {
      const existing = await getDocs(collection(db, "categories"));
      if (!existing.empty) return;

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
      console.warn("Category seed skipped:", err.message);
    }
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIBERS — Newsletter signups
// ═══════════════════════════════════════════════════════════════════════════

export const SubscribersAPI = {
  async subscribe(email) {
    const normalised = email.toLowerCase().trim();
    const ref = doc(db, "subscribers", normalised);
    const existing = await getDoc(ref);

    if (existing.exists() && existing.data().verified) {
      throw new Error("already_subscribed");
    }

    await setDoc(ref, {
      email:        normalised,
      verified:     true,
      subscribedAt: serverTimestamp(),
      verifiedAt:   serverTimestamp(),
    });

    return { email: normalised };
  },

  async verify(email) {
    await updateDoc(doc(db, "subscribers", email.toLowerCase()), {
      verified:   true,
      verifiedAt: serverTimestamp(),
    });
  },

  async getAll() {
    const snap = await getDocs(
      query(collection(db, "subscribers"), orderBy("subscribedAt", "desc"))
    );
    return snap.docs.map(d => stampToISO({ id: d.id, ...d.data() }));
  },

  async remove(email) {
    await deleteDoc(doc(db, "subscribers", email.toLowerCase()));
  },
};


// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY — Admin event log
// ═══════════════════════════════════════════════════════════════════════════

export const ActivityAPI = {
  async log(action, details) {
    // This will throw if user is not signed in (Firestore rules require auth).
    // All callers should use .catch(() => {}) to suppress the error for guests.
    await addDoc(collection(db, "activity"), {
      action,
      details,
      timestamp: serverTimestamp(),
    });
  },

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
