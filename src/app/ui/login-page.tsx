"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login-page.module.css";

type ApiResult<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

function mapErrorMessage(error: ApiResult<unknown>["error"], fallback: string) {
  if (!error) return fallback;
  if (error.code === "UNAUTHORIZED") return "Login failed. Please check your secret.";
  if (error.code === "CONFLICT") return "That email is already registered.";
  if (error.code === "TOO_MANY_REQUESTS") return "Too many attempts. Please wait and try again.";
  return error.message || fallback;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  const headers = new Headers(options?.headers || {});
  headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...options, headers });
  const body = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!body) {
    return { success: false, error: { code: "BAD_RESPONSE", message: "Server response could not be read." } };
  }

  return body;
}

export function LoginPage() {
  const router = useRouter();

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [globalError, setGlobalError] = useState("");
  const [successNote, setSuccessNote] = useState("");
  const [registerSecret, setRegisterSecret] = useState("");

  const [registerForm, setRegisterForm] = useState({
    email: "",
    displayName: "",
    bio: "",
    city: "",
    interests: "",
    inviteCode: "",
  });
  const [loginForm, setLoginForm] = useState({ email: "", secret: "" });

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const sessionRes = await apiRequest<{ userId: number }>("/api/auth/session", { method: "GET" });
        if (!mounted) return;
        if (sessionRes.success) {
          router.replace("/");
          return;
        }
      } finally {
        if (mounted) {
          setIsCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRegistering) return;

    setGlobalError("");
    setSuccessNote("");
    setRegisterSecret("");
    setIsRegistering(true);

    try {
      const res = await apiRequest<{ secret: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(registerForm),
      });

      if (!res.success) {
        setGlobalError(mapErrorMessage(res.error, "Registration failed."));
        return;
      }

      const nextSecret = res.data?.secret || "";
      setRegisterSecret(nextSecret);
      setLoginForm({ email: registerForm.email, secret: nextSecret });
      setSuccessNote("Account created. Save your secret now and use it to log in.");
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
      const res = await apiRequest<{ userId: number }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      if (!res.success) {
        setGlobalError(mapErrorMessage(res.error, "Login failed."));
        return;
      }

      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header>
          <h1>Sign in to AID-32</h1>
          <p className={styles.help}>Use your registration secret to continue.</p>
        </header>

        {globalError ? <p className={styles.error}>{globalError}</p> : null}
        {successNote ? <p className={styles.success}>{successNote}</p> : null}

        {isCheckingSession ? (
          <p className={styles.help}>Checking session...</p>
        ) : (
          <div className={styles.grid}>
            <form onSubmit={handleLogin} className={styles.card}>
              <h2>Login</h2>
              <input
                placeholder="Email"
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
              <input
                placeholder="Secret"
                type="password"
                value={loginForm.secret}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, secret: e.target.value }))}
                required
              />
              <button type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <form onSubmit={handleRegister} className={styles.card}>
              <h2>Create account</h2>
              <input
                placeholder="Email"
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
              <input
                placeholder="Display name"
                value={registerForm.displayName}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, displayName: e.target.value }))}
                required
              />
              <input
                placeholder="Invite code (if beta enabled)"
                value={registerForm.inviteCode}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, inviteCode: e.target.value }))}
              />
              <input
                placeholder="City"
                value={registerForm.city}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, city: e.target.value }))}
              />
              <textarea
                rows={3}
                placeholder="Bio"
                value={registerForm.bio}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, bio: e.target.value }))}
              />
              <input
                placeholder="Interests (comma separated)"
                value={registerForm.interests}
                onChange={(e) => setRegisterForm((prev) => ({ ...prev, interests: e.target.value }))}
              />
              <button type="submit" disabled={isRegistering}>
                {isRegistering ? "Creating account..." : "Create account"}
              </button>
              {registerSecret ? (
                <p className={styles.secret}>
                  One-time secret: <code>{registerSecret}</code>
                </p>
              ) : null}
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
