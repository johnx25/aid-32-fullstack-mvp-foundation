"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dating-mvp-app.module.css";

type Profile = {
  profileId: number;
  userId: number;
  email?: string;
  displayName: string;
  avatarUrl: string;
  bio: string | null;
  city: string | null;
  interests: string | null;
};

type DiscoveryProfile = Profile & { likedByCurrentUser: boolean };
type Match = { matchId: number; createdAt: string; displayName: string; profile: Omit<Profile, "userId" | "email" | "displayName"> | null };
type Message = { messageId: number; senderId: number; senderDisplayName: string; content: string; createdAt: string };

type ApiResult<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

function mapErrorMessage(error: ApiResult<unknown>["error"], fallback: string) {
  if (!error) return fallback;
  if (error.code === "CONFLICT") return "Diese E-Mail ist bereits registriert.";
  if (error.code === "PROFILE_INCOMPLETE") return "Bitte Profil vervollständigen (Avatar + Bio), bevor du likest.";
  if (error.code === "TOO_MANY_REQUESTS") return "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.";
  return error.message || fallback;
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResult<T>> {
  const headers = new Headers(options?.headers || {});
  headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...options, headers });
  const body = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!body) {
    return { success: false, error: { code: "BAD_RESPONSE", message: "Server response could not be read." } };
  }
  return body;
}

export function DatingMvpApp() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ userId: number; email: string; displayName: string } | null>(null);
  const [profileForm, setProfileForm] = useState({ displayName: "", avatarUrl: "/avatars/default.svg", bio: "", city: "", interests: "" });

  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");

  const [discovery, setDiscovery] = useState<DiscoveryProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  const [globalError, setGlobalError] = useState("");
  const [successNote, setSuccessNote] = useState("");

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [isLiking, setIsLiking] = useState<number | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const selectedMatch = useMemo(() => matches.find((m) => m.matchId === selectedMatchId) || null, [matches, selectedMatchId]);
  const canLikeOthers = Boolean(currentProfile?.bio?.trim() && currentProfile?.avatarUrl?.trim());

  const loadChat = useCallback(async (matchId: number) => {
    setIsLoadingChat(true);
    try {
      const res = await apiRequest<Message[]>(`/api/chats/${matchId}`, { method: "GET" });
      if (res.success) {
        setMessages(res.data || []);
      } else {
        setMessages([]);
        setGlobalError("Nachrichten konnten nicht geladen werden.");
      }
    } finally {
      setIsLoadingChat(false);
    }
  }, []);

  const refreshMainData = useCallback(async () => {
    setIsLoadingHome(true);
    setGlobalError("");

    try {
      const [profileRes, discoveryRes, matchesRes] = await Promise.all([
        apiRequest<Profile>("/api/profile", { method: "GET" }),
        apiRequest<DiscoveryProfile[]>("/api/discovery", { method: "GET" }),
        apiRequest<Match[]>("/api/matches", { method: "GET" }),
      ]);

      if (!profileRes.success) {
        setCurrentProfile(null);
        setGlobalError("Profil fehlt. Bitte vervollständige dein Profil.");
      } else {
        setCurrentProfile(profileRes.data || null);
        setProfileForm({
          displayName: profileRes.data?.displayName || "",
          avatarUrl: profileRes.data?.avatarUrl || "/avatars/default.svg",
          bio: profileRes.data?.bio || "",
          city: profileRes.data?.city || "",
          interests: profileRes.data?.interests || "",
        });
      }

      if (discoveryRes.success) {
        setDiscovery(discoveryRes.data || []);
      }

      if (matchesRes.success) {
        const nextMatches = matchesRes.data || [];
        setMatches(nextMatches);
        const nextSelectedMatchId = selectedMatchId || nextMatches[0]?.matchId || null;
        setSelectedMatchId(nextSelectedMatchId);
        if (nextSelectedMatchId) {
          await loadChat(nextSelectedMatchId);
        } else {
          setMessages([]);
        }
      }
    } finally {
      setIsLoadingHome(false);
    }
  }, [loadChat, selectedMatchId]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      try {
        const sessionRes = await apiRequest<{ userId: number; email: string; displayName: string }>("/api/auth/session", { method: "GET" });
        if (!isMounted) return;
        if (!sessionRes.success || !sessionRes.data) {
          setAuth(null);
          router.replace("/login");
          return;
        }

        setAuth(sessionRes.data);
        await refreshMainData();
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    void bootstrapSession();
    return () => {
      isMounted = false;
    };
  }, [refreshMainData, router]);

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
      );

      if (!res.success || !res.data) {
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
      );

      if (!res.success) {
        setGlobalError(mapErrorMessage(res.error, "Like konnte nicht gespeichert werden."));
        return;
      }

      if (res.data?.isMatch) {
        setSuccessNote("It’s a match! Ihr könnt jetzt chatten.");
      }

      await refreshMainData();
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
      );

      if (!res.success) {
        setGlobalError(mapErrorMessage(res.error, "Nachricht konnte nicht gesendet werden."));
        return;
      }

      setChatInput("");
      await loadChat(selectedMatchId);
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function logout() {
    await apiRequest<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
    setAuth(null);
    setCurrentProfile(null);
    setDiscovery([]);
    setMatches([]);
    setMessages([]);
    setSelectedMatchId(null);
    router.replace("/login");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.banner}>
          <header className={styles.header}>
            <div>
              <h1>AID-32 Match Console</h1>
              <p>Profil pflegen, neue Leute entdecken und direkt im gleichen Interface chatten.</p>
            </div>
            {auth ? (
              <button className={styles.secondaryButton} onClick={logout} type="button">
                Logout
              </button>
            ) : null}
          </header>
          <div className={styles.statRow}>
            <span className={styles.statChip}>Profile im Discover: {discovery.length}</span>
            <span className={styles.statChip}>Matches: {matches.length}</span>
            <span className={styles.statChip}>Nachrichten: {messages.length}</span>
          </div>
        </section>

        {globalError ? <p className={styles.error}>{globalError}</p> : null}
        {successNote ? <p className={styles.success}>{successNote}</p> : null}

        {isCheckingSession ? (
          <section className={styles.card}>
            <p className={styles.muted}>Checking session...</p>
          </section>
        ) : !auth ? (
          <section className={styles.card}>
            <p className={styles.muted}>Redirecting to login...</p>
          </section>
        ) : (
          <section className={styles.layout}>
            <div className={styles.column}>
              <article className={styles.card}>
                <h2>Your profile</h2>
                {isLoadingHome && !currentProfile ? <p className={styles.muted}>Loading profile...</p> : null}
                {!currentProfile && !isLoadingHome ? <p className={styles.empty}>Profile missing. Please save your profile to continue.</p> : null}
                <form onSubmit={handleSaveProfile}>
                  <input value={profileForm.displayName} onChange={(e) => setProfileForm((p) => ({ ...p, displayName: e.target.value }))} placeholder="Display name" required />
                  <input value={profileForm.avatarUrl} onChange={(e) => setProfileForm((p) => ({ ...p, avatarUrl: e.target.value }))} placeholder="Avatar URL" required />
                  <input value={profileForm.city} onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))} placeholder="City" />
                  <textarea value={profileForm.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} rows={3} placeholder="Bio" />
                  <input value={profileForm.interests} onChange={(e) => setProfileForm((p) => ({ ...p, interests: e.target.value }))} placeholder="Interests" />
                  <button className={styles.primaryButton} type="submit" disabled={isSavingProfile}>
                    {isSavingProfile ? "Saving..." : "Save profile"}
                  </button>
                </form>
                {!canLikeOthers ? <p className={styles.help}>Bitte mindestens Avatar und Bio setzen, bevor du andere likest.</p> : null}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Matches</h2>
                  <span>{matches.length}</span>
                </div>
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
                          await loadChat(match.matchId);
                        }
                      }}
                    >
                      <strong>{match.displayName}</strong>
                      <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              </article>
            </div>

            <div className={styles.column}>
              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Discover profiles</h2>
                  <span>{discovery.length}</span>
                </div>
                {isLoadingHome ? <p className={styles.muted}>Loading profiles...</p> : null}
                {!isLoadingHome && discovery.length === 0 ? <p className={styles.empty}>No profiles available yet.</p> : null}
                <div className={styles.profileList}>
                  {discovery.map((profile) => (
                    <div key={profile.profileId} className={styles.profileCard}>
                      <div className={styles.profileHeader}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profile.avatarUrl || "/avatars/default.svg"}
                          alt={`${profile.displayName} avatar`}
                          className={styles.avatar}
                          width={32}
                          height={32}
                          onError={(event) => {
                            event.currentTarget.src = "/avatars/default.svg";
                          }}
                        />
                        <h3>{profile.displayName}</h3>
                      </div>
                      <p>{profile.city || "City not set"}</p>
                      <p>{profile.bio || "No bio yet"}</p>
                      <p className={styles.muted}>{profile.interests || "No interests yet"}</p>
                      <div className={styles.row}>
                        <button className={styles.secondaryButton} type="button">Dislike</button>
                        <button className={styles.primaryButton} type="button" disabled={Boolean(isLiking) || !canLikeOthers} onClick={() => handleLike(profile.profileId)}>
                          {isLiking === profile.profileId ? "Liking..." : profile.likedByCurrentUser ? "Liked" : "Like"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div className={styles.column}>
              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Chat</h2>
                  <span>{selectedMatch ? selectedMatch.displayName : "Kein Match"}</span>
                </div>
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
                  <input value={chatInput} maxLength={500} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message" disabled={!selectedMatch || isSendingMessage} />
                  <button className={styles.primaryButton} disabled={!selectedMatch || isSendingMessage} type="submit">
                    {isSendingMessage ? "Sending..." : "Send"}
                  </button>
                </form>
              </article>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
