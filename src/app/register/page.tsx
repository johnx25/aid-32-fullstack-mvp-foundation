"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type RegisterResponse = {
  data?: {
    userId: number;
    email: string;
    displayName: string;
    secret: string;
  };
  error?: string;
};

const MIN_SECRET_LENGTH = 12;

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [secret, setSecret] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegisterResponse["data"]>();

  const secretLengthError = useMemo(() => {
    if (!secret) {
      return "";
    }

    return secret.length < MIN_SECRET_LENGTH
      ? `Secret must be at least ${MIN_SECRET_LENGTH} characters.`
      : "";
  }, [secret]);

  const canSubmit = email.trim() && displayName.trim() && !secretLengthError && !isSubmitting;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(undefined);

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          secret: secret.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as RegisterResponse;

      if (!response.ok || !payload.data) {
        setError(payload.error || "Registration failed.");
        return;
      }

      setResult(payload.data);
      setSecret("");
    } catch {
      setError("Unexpected network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ margin: "2rem auto", maxWidth: 560, padding: "0 1rem" }}>
      <h1>Create account</h1>
      <p>Register to get your one-time auth secret for MVP endpoints.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="name@example.com"
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <label>
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            placeholder="Alex"
            style={{ display: "block", width: "100%" }}
          />
        </label>

        <label>
          Secret (optional)
          <input
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="Leave empty to auto-generate"
            style={{ display: "block", width: "100%" }}
          />
        </label>

        {secretLengthError ? <p style={{ color: "#b00020", margin: 0 }}>{secretLengthError}</p> : null}
        {error ? <p style={{ color: "#b00020", margin: 0 }}>{error}</p> : null}

        <button type="submit" disabled={!canSubmit} style={{ width: 220 }}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      {result ? (
        <section style={{ marginTop: 20, padding: 12, border: "1px solid #c8d8ff", borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>Account created</h2>
          <p style={{ marginBottom: 8 }}>User ID: {result.userId}</p>
          <p style={{ marginBottom: 8 }}>Email: {result.email}</p>
          <p style={{ marginBottom: 8 }}>Display name: {result.displayName}</p>
          <p style={{ marginBottom: 8 }}>
            Secret: <code>{result.secret}</code>
          </p>
          <p style={{ marginBottom: 0 }}>Save this secret now. You need it for login and authenticated API calls.</p>
        </section>
      ) : null}

      <p style={{ marginTop: 20 }}>
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
