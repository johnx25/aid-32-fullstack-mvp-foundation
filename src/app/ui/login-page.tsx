"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./login-page.module.css";

type ApiResult<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

type LoginResponseData = {
  userId: number;
  email: string;
  displayName: string;
  authTokenExpiresAt: string;
  redirectTo: string;
};

function normalizeEmailInput(email: string) {
  return email.trim().toLowerCase();
}

function normalizeLoginInput(input: { email: string; password: string }) {
  return {
    email: normalizeEmailInput(input.email),
    password: input.password.trim(),
  };
}

function isValidLoginResponseData(data: unknown): data is LoginResponseData {
  if (!data || typeof data !== "object") return false;
  const value = data as Partial<LoginResponseData>;
  return (
    typeof value.userId === "number" &&
    Number.isFinite(value.userId) &&
    value.userId > 0 &&
    typeof value.email === "string" &&
    value.email.length > 0 &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0 &&
    typeof value.authTokenExpiresAt === "string" &&
    value.authTokenExpiresAt.length > 0
  );
}

function mapErrorMessage(error: ApiResult<unknown>["error"], fallback: string) {
  if (!error) return fallback;
  if (error.code === "UNAUTHORIZED") return "Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.";
  if (error.code === "TOO_MANY_REQUESTS") return "Zu viele Versuche. Bitte kurz warten.";
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const res = await apiRequest<{ userId: number }>("/api/auth/session", { method: "GET" });
        if (!mounted) return;
        if (res.success) {
          router.replace("/matches");
          return;
        }
      } finally {
        if (mounted) setIsCheckingSession(false);
      }
    }
    void checkSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoggingIn) return;

    setGlobalError("");
    setIsLoggingIn(true);

    try {
      const normalized = normalizeLoginInput(loginForm);
      const res = await apiRequest<LoginResponseData>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalized.email, secret: normalized.password }),
      });

      if (!res.success) {
        setGlobalError(mapErrorMessage(res.error, "Login fehlgeschlagen."));
        return;
      }

      if (!isValidLoginResponseData(res.data)) {
        setGlobalError("Login fehlgeschlagen. Ungültige Server-Antwort.");
        return;
      }

      router.replace(res.data.redirectTo ?? "/matches");
      router.refresh();
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Tamil Dating</p>
        <h1>Willkommen zurück</h1>
        <p className={styles.subtitle}>
          Melde dich an und entdecke deine Matches.
        </p>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2>Anmelden</h2>
          <p className={styles.help}>
            {isCheckingSession ? "Session wird geprüft…" : "Gib deine E-Mail und dein Passwort ein."}
          </p>
        </header>

        {globalError ? <p className={styles.error}>{globalError}</p> : null}

        <div className={styles.grid}>
          <form onSubmit={handleLogin} method="post" action="#" className={styles.card}>
            <label htmlFor="login-email">
              E-Mail
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="du@beispiel.de"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={loginForm.email}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </label>

            <label htmlFor="login-password">
              Passwort
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="Mindestens 8 Zeichen"
                autoComplete="current-password"
                minLength={8}
                maxLength={128}
                value={loginForm.password}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </label>

            <button type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? "Anmelden…" : "Anmelden"}
            </button>
          </form>

          <aside className={styles.card}>
            <h3>Noch kein Account?</h3>
            <p className={styles.help}>Registriere dich und finde dein Match.</p>
            <Link href="/register" className={styles.linkButton}>
              Account erstellen
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
