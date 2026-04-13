// ═══════════════════════════════════════════════════════════════════════════
// src/context/AuthContext.jsx
// THE JAAGA DESK — Global Auth State
//
// Wraps the whole app. Any component can call useAuth() to get:
//   currentUser   — the logged-in user object (or null)
//   loading       — true while Firebase checks session on page load
//   login()       — sign in function
//   logout()      — sign out function
//   register()    — register function
// ═══════════════════════════════════════════════════════════════════════════

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthAPI, UsersAPI } from "../lib/db";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading]         = useState(true);  // Firebase is checking session

  // On mount, subscribe to Firebase auth state.
  // This fires immediately with the cached session — no flicker on refresh.
  useEffect(() => {
    const unsubscribe = AuthAPI.onAuthChange((user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe; // Clean up listener on unmount
  }, []);

  const login = useCallback(async (credentials) => {
    const user = await AuthAPI.login(credentials);
    setCurrentUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await AuthAPI.logout();
    setCurrentUser(null);
  }, []);

  const register = useCallback(async (data) => {
    const user = await AuthAPI.register(data);
    return user;
  }, []);

  // Update local user state after profile edits
  const refreshUser = useCallback(async () => {
    if (!currentUser?.uid) return;
    const fresh = await UsersAPI.get(currentUser.uid);
    setCurrentUser(fresh);
  }, [currentUser]);

  const value = {
    currentUser,
    loading,
    login,
    logout,
    register,
    refreshUser,
    setCurrentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Don't render children until Firebase has checked session.
          This prevents a flash where logged-in users see the logged-out UI. */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
