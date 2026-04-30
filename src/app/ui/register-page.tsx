"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./register-page.module.css";
import {
  ApiResult,
  RegisterResponseData,
  isValidRegisterResponseData,
  mapErrorMessage,
  normalizeRegisterInput,
} from "./register-page.logic";

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
  const [sessionCheckError, setSessionCheckError] = useState("");
  const [successNote, setSuccessNote] = useState("");
  const [registerSecret, setRegisterSecret] = useState("");
  const [postRegisterRedirectTo, setPostRegisterRedirectTo] = useState("");

  const [registerForm, setRegisterForm] = useState({
    email: "",
    name: "",
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
        setSessionCheckError("No active session found. You can create a new account below.");
      } catch {
        if (mounted) {
          setSessionCheckError("Session check failed. You can still register.");
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
    setPostRegisterRedirectTo("");
    setIsRegistering(true);

    try {
      const nextRegisterForm = normalizeRegisterInput(registerForm);
      if (!nextRegisterForm.displayName || !nextRegisterForm.email) {
        setError("Name and email are required.");
        return;
      }
      const res = await apiRequest<RegisterResponseData>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: nextRegisterForm.email,
          displayName: nextRegisterForm.displayName,
          bio: nextRegisterForm.bio,
          city: nextRegisterForm.city,
          interests: nextRegisterForm.interests,
          inviteCode: nextRegisterForm.inviteCode,
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

      setRegisterForm((prev) => ({
        ...prev,
        email: nextRegisterForm.email,
        name: nextRegisterForm.displayName,
        bio: nextRegisterForm.bio,
        city: nextRegisterForm.city,
        interests: nextRegisterForm.interests,
        inviteCode: nextRegisterForm.inviteCode,
      }));
      setRegisterSecret(res.data.secret);
      setPostRegisterRedirectTo(res.data.redirectTo);
      setSuccessNote("Account created. Save your one-time secret, then continue.");
    } finally {
      setIsRegistering(false);
    }
  }

  function handleContinueAfterSecret() {
    if (!postRegisterRedirectTo) return;
    router.replace(postRegisterRedirectTo);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>AID-32</p>
        <h1>Create your account</h1>
        <p className={styles.subtitle}>Sign up to start matching, chatting, and building your profile.</p>
      </section>

      <section className={styles.panel}>
        <p className={styles.help}>{isCheckingSession ? "Checking session..." : sessionCheckError || "No active session."}</p>
        {error ? <p className={styles.error}>{error}</p> : null}
        {successNote ? <p className={styles.success}>{successNote}</p> : null}

        <form onSubmit={handleRegister} className={styles.form}>
          <label>
            Name
            <input
              placeholder="Alex"
              value={registerForm.name}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>

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

          <label>
            Invite code
            <input
              placeholder="Optional unless beta mode is on"
              value={registerForm.inviteCode}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, inviteCode: e.target.value }))}
            />
          </label>

          <button type="submit" disabled={isRegistering}>
            {isRegistering ? "Creating account..." : "Create account"}
          </button>
        </form>

        {registerSecret ? (
          <>
            <p className={styles.secret}>
              One-time secret: <code>{registerSecret}</code>
            </p>
            <button
              type="button"
              className={styles.continueButton}
              onClick={handleContinueAfterSecret}
              disabled={!postRegisterRedirectTo}
            >
              I have saved my secret
            </button>
          </>
        ) : null}

        <p className={styles.switch}>
          Already have an account? <Link href="/login">Go to login</Link>
        </p>
      </section>
    </main>
  );
}
