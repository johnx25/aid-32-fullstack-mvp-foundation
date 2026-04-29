"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import styles from "./dating-mvp-app.module.css";

type Profile = {
  profileId: number;
  userId: number;
  email?: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  interests: string | null;
};

type DiscoveryProfile = Profile & { likedByCurrentUser: boolean };
type Match = { matchId: number; createdAt: string; displayName: string; profile: Omit<Profile, "userId" | "email" | "displayName"> | null };
type Message = { messageId: number; senderId: number; senderDisplayName: string; content: string; createdAt: string };

type ApiResult<T> = { ok: boolean; data?: T; error?: { code: string; message: string } };

const storageKey = "aid32-mvp-auth";

function mapErrorMessage(error: ApiResult<unknown>["error"], fallback: string) {
  if (!error) return fallback;
  if (error.code === "UNAUTHORIZED") return "Login fehlgeschlagen: Bitte Secret prüfen.";
  if (error.code === "CONFLICT") return "Diese E-Mail ist bereits registriert.";
  return error.message || fallback;
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
  auth?: { authToken: string; userId: number } | null,
): Promise<ApiResult<T>> {
  const headers = new Headers(options?.headers || {});
  headers.set("Content-Type", "application/json");
  if (auth) {
    headers.set("x-auth-token", auth.authToken);
    headers.set("x-user-id", String(auth.userId));
  }

  const response = await fetch(path, { ...options, headers });
  const body = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!body) {
    return { ok: false, error: { code: "BAD_RESPONSE", message: "Server response could not be read." } };
  }
  return body;
}

export function DatingMvpApp() {
  const [auth, setAuth] = useState<{ userId: number; authToken: string; email: string; displayName: string } | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { userId: number; authToken: string; email: string; displayName: string };
      return parsed.authToken && parsed.userId ? parsed : null;
    } catch {
      window.localStorage.removeItem(storageKey);
      return null;
    }
  });
  const [registerForm, setRegisterForm] = useState({ email: "", displayName: "", bio: "", city: "", interests: "" });
  const [loginForm, setLoginForm] = useState({ email: "", secret: "" });
  const [profileForm, setProfileForm] = useState({ displayName: "", bio: "", city: "", interests: "" });

  const [registerSecret, setRegisterSecret] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");

  const [discovery, setDiscovery] = useState<DiscoveryProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  const [globalError, setGlobalError] = useState("");
  const [successNote, setSuccessNote] = useState("");

  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [isLiking, setIsLiking] = useState<number | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const selectedMatch = useMemo(() => matches.find((m) => m.matchId === selectedMatchId) || null, [matches, selectedMatchId]);

  const loadChat = useCallback(async (matchId: number, activeAuth: { userId: number; authToken: string }) => {
    setIsLoadingChat(true);
    try {
      const res = await apiRequest<Message[]>(`/api/chats/${matchId}`, { method: "GET" }, activeAuth);
      if (res.ok) {
        setMessages(res.data || []);
      } else {
        setMessages([]);
        setGlobalError("Nachrichten konnten nicht geladen werden.");
      }
    } finally {
      setIsLoadingChat(false);
    }
  }, []);

  const refreshMainData = useCallback(async (activeAuth: { userId: number; authToken: string }) => {
    setIsLoadingHome(true);
    setGlobalError("");

    try {
      const [profileRes, discoveryRes, matchesRes] = await Promise.all([
        apiRequest<Profile>("/api/profile", { method: "GET" }, activeAuth),
        apiRequest<DiscoveryProfile[]>("/api/discovery", { method: "GET" }, activeAuth),
        apiRequest<Match[]>("/api/matches", { method: "GET" }, activeAuth),
      ]);

      if (!profileRes.ok) {
        setCurrentProfile(null);
        setGlobalError("Profil fehlt. Bitte vervollständige dein Profil.");
      } else {
        setCurrentProfile(profileRes.data || null);
        setProfileForm({
          displayName: profileRes.data?.displayName || "",
          bio: profileRes.data?.bio || "",
          city: profileRes.data?.city || "",
          interests: profileRes.data?.interests || "",
        });
      }

      if (discoveryRes.ok) {
        setDiscovery(discoveryRes.data || []);
      }

      if (matchesRes.ok) {
        const nextMatches = matchesRes.data || [];
        setMatches(nextMatches);
        const nextSelectedMatchId = selectedMatchId || nextMatches[0]?.matchId || null;
        setSelectedMatchId(nextSelectedMatchId);
        if (nextSelectedMatchId) {
          await loadChat(nextSelectedMatchId, activeAuth);
        } else {
          setMessages([]);
        }
      }
    } finally {
      setIsLoadingHome(false);
    }
  }, [loadChat, selectedMatchId]);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRegistering) return;
    setGlobalError("");
    setSuccessNote("");
    setIsRegistering(true);

    try {
      const res = await apiRequest<{ secret: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(registerForm),
      });

      if (!res.ok) {
        setGlobalError(mapErrorMessage(res.error, "Registrierung fehlgeschlagen."));
        return;
      }

      setRegisterSecret(res.data?.secret || "");
      setLoginForm((prev) => ({ ...prev, email: registerForm.email, secret: res.data?.secret || "" }));
      setSuccessNote("Konto erstellt. Secret sicher speichern und für den Login verwenden.");
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoggingIn) return;
    setGlobalError("");
    setSuccessNote("");
    setIsLoggingIn(true);

    try {
      const res = await apiRequest<{ userId: number; authToken: string; email: string; displayName: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      if (!res.ok || !res.data) {
        setGlobalError(mapErrorMessage(res.error, "Login fehlgeschlagen."));
        return;
      }

      setAuth(res.data);
      window.localStorage.setItem(storageKey, JSON.stringify(res.data));
      await refreshMainData(res.data);
      setSuccessNote("Erfolgreich eingeloggt.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || isSavingProfile) return;

    setIsSavingProfile(true);
    setGlobalError("");
    setSuccessNote("");

    try {
      const res = await apiRequest<Profile>(
        "/api/profile",
        {
          method: "PATCH",
          body: JSON.stringify(profileForm),
        },
        auth,
      );

      if (!res.ok || !res.data) {
        setGlobalError("Profil konnte nicht gespeichert werden. Bitte erneut versuchen.");
        return;
      }

      setCurrentProfile(res.data);
      setSuccessNote("Profil gespeichert.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleLike(profileId: number) {
    if (!auth || isLiking) return;
    setIsLiking(profileId);
    setGlobalError("");
    setSuccessNote("");

    try {
      const res = await apiRequest<{ isMatch: boolean }>(
        "/api/likes",
        {
          method: "POST",
          body: JSON.stringify({ targetProfileId: profileId }),
        },
        auth,
      );

      if (!res.ok) {
        setGlobalError("Like konnte nicht gespeichert werden.");
        return;
      }

      if (res.data?.isMatch) {
        setSuccessNote("It’s a match! Ihr könnt jetzt chatten.");
      }

      await refreshMainData(auth);
    } finally {
      setIsLiking(null);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedMatchId || isSendingMessage) return;
    if (!chatInput.trim()) return;

    setIsSendingMessage(true);
    setGlobalError("");

    try {
      const res = await apiRequest<Message>(
        `/api/chats/${selectedMatchId}`,
        {
          method: "POST",
          body: JSON.stringify({ content: chatInput.trim() }),
        },
        auth,
      );

      if (!res.ok) {
        setGlobalError("Nachricht konnte nicht gesendet werden.");
        return;
      }

      setChatInput("");
      await loadChat(selectedMatchId, auth);
    } finally {
      setIsSendingMessage(false);
    }
  }

  function logout() {
    setAuth(null);
    setCurrentProfile(null);
    setDiscovery([]);
    setMatches([]);
    setMessages([]);
    setSelectedMatchId(null);
    window.localStorage.removeItem(storageKey);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>AID-32 Dating MVP</h1>
          <p>Demo-ready flow: Register, Login, Profile, Discovery, Match, Chat</p>
        </div>
        {auth ? (
          <button className={styles.secondaryButton} onClick={logout} type="button">
            Logout
          </button>
        ) : null}
      </header>

      {globalError ? <p className={styles.error}>{globalError}</p> : null}
      {successNote ? <p className={styles.success}>{successNote}</p> : null}

      {!auth ? (
        <section className={styles.authGrid}>
          <form onSubmit={handleRegister} className={styles.card}>
            <h2>Register</h2>
            <input placeholder="Email" value={registerForm.email} onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))} required />
            <input placeholder="Display Name" value={registerForm.displayName} onChange={(e) => setRegisterForm((p) => ({ ...p, displayName: e.target.value }))} required />
            <input placeholder="City" value={registerForm.city} onChange={(e) => setRegisterForm((p) => ({ ...p, city: e.target.value }))} />
            <textarea placeholder="Bio" rows={3} value={registerForm.bio} onChange={(e) => setRegisterForm((p) => ({ ...p, bio: e.target.value }))} />
            <input placeholder="Interests (comma separated)" value={registerForm.interests} onChange={(e) => setRegisterForm((p) => ({ ...p, interests: e.target.value }))} />
            <button className={styles.primaryButton} type="submit" disabled={isRegistering}>
              {isRegistering ? "Creating account..." : "Create account"}
            </button>
            {registerSecret ? <p className={styles.secret}>One-time secret: <code>{registerSecret}</code></p> : null}
          </form>

          <form onSubmit={handleLogin} className={styles.card}>
            <h2>Login</h2>
            <input placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} required />
            <input placeholder="Secret" value={loginForm.secret} onChange={(e) => setLoginForm((p) => ({ ...p, secret: e.target.value }))} required />
            <button className={styles.primaryButton} type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in..." : "Sign in"}
            </button>
            <p className={styles.help}>Use the secret you received during registration.</p>
          </form>
        </section>
      ) : (
        <section className={styles.appGrid}>
          <article className={styles.card}>
            <h2>Your profile</h2>
            {isLoadingHome && !currentProfile ? <p className={styles.muted}>Loading profile...</p> : null}
            {!currentProfile && !isLoadingHome ? <p className={styles.empty}>Profile missing. Please save your profile to continue.</p> : null}
            <form onSubmit={handleSaveProfile}>
              <input value={profileForm.displayName} onChange={(e) => setProfileForm((p) => ({ ...p, displayName: e.target.value }))} placeholder="Display name" required />
              <input value={profileForm.city} onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))} placeholder="City" />
              <textarea value={profileForm.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} rows={3} placeholder="Bio" />
              <input value={profileForm.interests} onChange={(e) => setProfileForm((p) => ({ ...p, interests: e.target.value }))} placeholder="Interests" />
              <button className={styles.primaryButton} type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save profile"}
              </button>
            </form>
          </article>

          <article className={styles.card}>
            <h2>Discover profiles</h2>
            {isLoadingHome ? <p className={styles.muted}>Loading profiles...</p> : null}
            {!isLoadingHome && discovery.length === 0 ? <p className={styles.empty}>No profiles available yet.</p> : null}
            <div className={styles.profileList}>
              {discovery.map((profile) => (
                <div key={profile.profileId} className={styles.profileCard}>
                  <h3>{profile.displayName}</h3>
                  <p>{profile.city || "City not set"}</p>
                  <p>{profile.bio || "No bio yet"}</p>
                  <p className={styles.muted}>{profile.interests || "No interests yet"}</p>
                  <div className={styles.row}>
                    <button className={styles.secondaryButton} type="button">Dislike</button>
                    <button className={styles.primaryButton} type="button" disabled={Boolean(isLiking)} onClick={() => handleLike(profile.profileId)}>
                      {isLiking === profile.profileId ? "Liking..." : profile.likedByCurrentUser ? "Liked" : "Like"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.card}>
            <h2>Matches</h2>
            {isLoadingHome ? <p className={styles.muted}>Loading matches...</p> : null}
            {!isLoadingHome && matches.length === 0 ? <p className={styles.empty}>No matches yet.</p> : null}
            <div className={styles.matchList}>
              {matches.map((match) => (
                <button
                  key={match.matchId}
                  type="button"
                  className={`${styles.matchItem} ${match.matchId === selectedMatchId ? styles.matchItemActive : ""}`}
                  onClick={async () => {
                    setSelectedMatchId(match.matchId);
                    if (auth) {
                      await loadChat(match.matchId, auth);
                    }
                  }}
                >
                  <strong>{match.displayName}</strong>
                  <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </article>

          <article className={styles.card}>
            <h2>Chat</h2>
            {!selectedMatch ? <p className={styles.empty}>No match selected yet.</p> : null}
            {selectedMatch && isLoadingChat ? <p className={styles.muted}>Loading messages...</p> : null}
            {selectedMatch && !isLoadingChat && messages.length === 0 ? <p className={styles.empty}>No messages yet. Start the conversation.</p> : null}
            <div className={styles.messages}>
              {messages.map((message) => (
                <div key={message.messageId} className={`${styles.message} ${message.senderId === auth.userId ? styles.messageOwn : ""}`}>
                  <p>{message.content}</p>
                  <span>{message.senderDisplayName}</span>
                </div>
              ))}
            </div>
            <form className={styles.row} onSubmit={handleSendMessage}>
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message" disabled={!selectedMatch || isSendingMessage} />
              <button className={styles.primaryButton} disabled={!selectedMatch || isSendingMessage} type="submit">
                {isSendingMessage ? "Sending..." : "Send"}
              </button>
            </form>
          </article>
        </section>
      )}
    </main>
  );
}
