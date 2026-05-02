"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./register-page.module.css";

type ApiResult<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

type RegisterResponseData = {
  userId: number;
  email: string;
  displayName: string;
  authTokenExpiresAt: string;
  redirectTo: string;
};

function isValidRegisterResponseData(data: unknown): data is RegisterResponseData {
  if (!data || typeof data !== "object") return false;
  const v = data as Partial<RegisterResponseData>;
  return (
    typeof v.userId === "number" &&
    v.userId > 0 &&
    typeof v.email === "string" &&
    v.email.length > 0 &&
    typeof v.redirectTo === "string" &&
    v.redirectTo.length > 0
  );
}

function mapErrorMessage(error: ApiResult<unknown>["error"], fallback: string) {
  if (!error) return fallback;
  if (error.code === "CONFLICT") return "An account with this email already exists.";
  if (error.code === "FORBIDDEN") return error.message || "Registration not permitted.";
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

const MAX_BIRTH_DATE = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
  .toISOString()
  .split("T")[0];

export function RegisterPage() {
  const router = useRouter();

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", birthDate: "" });

  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const res = await apiRequest<{ userId: number }>("/api/auth/session", { method: "GET" });
        if (!mounted) return;
        if (res.success) {
          router.replace("/");
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

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRegistering) return;

    setError("");
    setIsRegistering(true);

    try {
      const res = await apiRequest<RegisterResponseData>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          birthDate: form.birthDate,
        }),
      });

      if (!res.success) {
        setError(mapErrorMessage(res.error, "Registration failed."));
        return;
      }

      if (!isValidRegisterResponseData(res.data)) {
        setError("Registration failed due to an invalid server response.");
        return;
      }

      router.replace(res.data.redirectTo);
      router.refresh();
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <main className={styles.page}>
      {/* Left hero panel */}
      <section className={styles.hero}>
        <p className={styles.kicker}>Tamil Dating</p>
        <h1>Find your person — without getting ghosted.</h1>
        <p className={styles.subtitle}>
          The serious dating platform built exclusively for the Tamil community. Real profiles, real conversations.
        </p>
      </section>

      {/* Right form panel */}
      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2>Create your account</h2>
          <p className={styles.help}>
            {isCheckingSession ? "Checking session…" : "Join thousands of Tamil singles."}
          </p>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}

        <form onSubmit={handleRegister} method="post" action="#" className={styles.form}>
          <label htmlFor="register-email">
            Email
            <input
              id="register-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>

          <label htmlFor="register-password">
            Password
            <input
              id="register-password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>

          <label htmlFor="register-birthdate">
            Date of Birth
            <input
              id="register-birthdate"
              name="birthDate"
              type="date"
              autoComplete="bday"
              max={MAX_BIRTH_DATE}
              value={form.birthDate}
              onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
              required
            />
          </label>

          <button type="submit" disabled={isRegistering}>
            {isRegistering ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
