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
  secret: string;
};

function normalizeEmailInput(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRegisterInput(input: {
  email: string;
  displayName: string;
  bio: string;
  city: string;
  interests: string;
  inviteCode: string;
}) {
  return {
    email: normalizeEmailInput(input.email),
    displayName: input.displayName.trim(),
    bio: input.bio.trim(),
    city: input.city.trim(),
    interests: input.interests.trim(),
    inviteCode: input.inviteCode.trim(),
  };
}

function isValidRegisterResponseData(data: unknown): data is RegisterResponseData {
  if (!data || typeof data !== "object") return false;
  const value = data as Partial<RegisterResponseData>;
  return (
    typeof value.userId === "number" &&
    Number.isFinite(value.userId) &&
    value.userId > 0 &&
    typeof value.email === "string" &&
    value.email.length > 0 &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0 &&
    typeof value.secret === "string" &&
    value.secret.trim().length > 0
  );
}

function mapErrorMessage(error: ApiResult<unknown>["error"], fallback: string) {
  if (!error) return fallback;
  if (error.code === "CONFLICT") return "That email is already registered.";
  if (error.code === "FORBIDDEN") return "A valid invite code is required right now.";
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

export function RegisterPage() {
  const router = useRouter();

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
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

    setError("");
    setSuccessNote("");
    setRegisterSecret("");
    setIsRegistering(true);

    try {
      const nextRegisterForm = normalizeRegisterInput(registerForm);
      const res = await apiRequest<RegisterResponseData>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(nextRegisterForm),
      });

      if (!res.success) {
        setError(mapErrorMessage(res.error, "Registration failed."));
        return;
      }

      if (!isValidRegisterResponseData(res.data)) {
        setError("Registration failed due to an invalid server response.");
        return;
      }

      setRegisterForm(nextRegisterForm);
      setRegisterSecret(res.data.secret);
      setSuccessNote("Account created. Save your one-time secret before leaving this page.");
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>AID-32</p>
        <h1>Create your account</h1>
        <p className={styles.subtitle}>Sign up to start matching, chatting, and building your profile.</p>
      </section>

      <section className={styles.panel}>
        {isCheckingSession ? (
          <p className={styles.help}>Checking session...</p>
        ) : (
          <>
            {error ? <p className={styles.error}>{error}</p> : null}
            {successNote ? <p className={styles.success}>{successNote}</p> : null}

            <form onSubmit={handleRegister} className={styles.form}>
              <label>
                Email
                <input
                  placeholder="you@example.com"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </label>

              <label>
                Display name
                <input
                  placeholder="Alex"
                  value={registerForm.displayName}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  required
                />
              </label>

              <label>
                Invite code
                <input
                  placeholder="Optional unless beta mode is on"
                  value={registerForm.inviteCode}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, inviteCode: e.target.value }))}
                />
              </label>

              <label>
                City
                <input
                  placeholder="Berlin"
                  value={registerForm.city}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, city: e.target.value }))}
                />
              </label>

              <label>
                Bio
                <textarea
                  rows={4}
                  placeholder="Tell others what you are into"
                  value={registerForm.bio}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, bio: e.target.value }))}
                />
              </label>

              <label>
                Interests
                <input
                  placeholder="hiking, coffee, live music"
                  value={registerForm.interests}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, interests: e.target.value }))}
                />
              </label>

              <button type="submit" disabled={isRegistering}>
                {isRegistering ? "Creating account..." : "Create account"}
              </button>
            </form>

            {registerSecret ? (
              <p className={styles.secret}>
                One-time secret: <code>{registerSecret}</code>
              </p>
            ) : null}

            <p className={styles.switch}>
              Already have an account? <Link href="/login">Go to login</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
