"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./profile-edit-page.module.css";

type ApiResult<T> = { success: boolean; data?: T; error?: { code: string; message: string } };

type ProfileData = {
  profileId: number;
  userId: number;
  displayName: string;
  bio: string | null;
  city: string | null;
  interests: string | null;
  avatarUrl: string;
};

type GeocodeResult = {
  city: string;
  country: string | null;
  countryCode: string | null;
};

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

type LocationState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "success"; city: string; country: string | null }
  | { status: "error"; message: string };

export function ProfileEditPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    city: "",
    interests: "",
  });

  const [locationState, setLocationState] = useState<LocationState>({ status: "idle" });

  // Load current profile on mount
  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const res = await apiRequest<ProfileData>("/api/profile", { method: "GET" });
        if (!mounted) return;
        if (!res.success) {
          if (res.error?.code === "UNAUTHORIZED") {
            router.replace("/login");
            return;
          }
          setError("Profil konnte nicht geladen werden.");
          return;
        }
        if (res.data) {
          setForm({
            displayName: res.data.displayName ?? "",
            bio: res.data.bio ?? "",
            city: res.data.city ?? "",
            interests: res.data.interests ?? "",
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void loadProfile();
    return () => { mounted = false; };
  }, [router]);

  // GPS location detection
  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationState({ status: "error", message: "Standortbestimmung wird von diesem Browser nicht unterstützt." });
      return;
    }

    setLocationState({ status: "requesting" });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const res = await apiRequest<GeocodeResult>(
            `/api/geocode/reverse?lat=${latitude}&lon=${longitude}`,
            { method: "GET" },
          );

          if (!res.success || !res.data) {
            setLocationState({
              status: "error",
              message: res.error?.message ?? "Stadt konnte nicht ermittelt werden.",
            });
            return;
          }

          const { city, country } = res.data;
          setLocationState({ status: "success", city, country: country ?? null });
          setForm((prev) => ({ ...prev, city }));
          setTimeout(() => setLocationState({ status: "idle" }), 4000);
        } catch {
          setLocationState({ status: "error", message: "Geocoding fehlgeschlagen. Bitte manuell eingeben." });
        }
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Standortzugriff verweigert. Bitte in den Browser-Einstellungen erlauben.",
          2: "Standort konnte nicht ermittelt werden.",
          3: "Standortanfrage hat zu lange gedauert.",
        };
        setLocationState({
          status: "error",
          message: messages[err.code] ?? "Unbekannter Standortfehler.",
        });
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setError("");
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      const res = await apiRequest<ProfileData>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          bio: form.bio.trim(),
          city: form.city.trim(),
          interests: form.interests.trim(),
        }),
      });

      if (!res.success) {
        setError(res.error?.message ?? "Speichern fehlgeschlagen.");
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Profil wird geladen…</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <h1>Profil bearbeiten</h1>
          <p className={styles.subtitle}>Zeige anderen, wer du wirklich bist.</p>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}
        {saveSuccess ? <p className={styles.success}>Profil gespeichert ✓</p> : null}

        <form onSubmit={handleSave} method="post" action="#" className={styles.form}>
          {/* Display name */}
          <label htmlFor="profile-displayname">
            Name
            <input
              id="profile-displayname"
              name="displayName"
              type="text"
              placeholder="Dein Anzeigename"
              minLength={2}
              maxLength={80}
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              required
            />
          </label>

          {/* Bio */}
          <label htmlFor="profile-bio">
            Über mich
            <textarea
              id="profile-bio"
              name="bio"
              placeholder="Erzähl etwas über dich…"
              maxLength={500}
              rows={4}
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
            />
          </label>

          {/* City + GPS */}
          <label htmlFor="profile-city">
            Stadt
            <div className={styles.cityRow}>
              <input
                id="profile-city"
                name="city"
                type="text"
                placeholder="z.B. Köln"
                maxLength={120}
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              />
              <button
                type="button"
                className={styles.gpsButton}
                onClick={requestLocation}
                disabled={locationState.status === "requesting"}
                title="Automatisch erkennen"
                aria-label="Standort automatisch erkennen"
              >
                {locationState.status === "requesting" ? "…" : "📍"}
              </button>
            </div>

            {locationState.status === "requesting" && (
              <span className={styles.locationHint}>Standort wird ermittelt…</span>
            )}
            {locationState.status === "success" && (
              <span className={styles.locationSuccess}>
                Erkannt: {locationState.city}{locationState.country ? `, ${locationState.country}` : ""}
              </span>
            )}
            {locationState.status === "error" && (
              <span className={styles.locationError}>{locationState.message}</span>
            )}
            <span className={styles.privacyNote}>
              🔒 Nur die Stadt wird gespeichert — keine genaue Adresse.
            </span>
          </label>

          {/* Interests */}
          <label htmlFor="profile-interests">
            Interessen
            <input
              id="profile-interests"
              name="interests"
              type="text"
              placeholder="z.B. Kochen, Wandern, Musik"
              maxLength={500}
              value={form.interests}
              onChange={(e) => setForm((prev) => ({ ...prev, interests: e.target.value }))}
            />
          </label>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={() => router.back()}>
              Abbrechen
            </button>
            <button type="submit" className={styles.saveButton} disabled={isSaving}>
              {isSaving ? "Wird gespeichert…" : "Speichern"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
