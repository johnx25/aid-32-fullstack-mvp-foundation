"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  gender: string | null;
  interestedIn: string | null;
  height: number | null;
  education: string | null;
  job: string | null;
  religion: string | null;
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
    gender: "",
    interestedIn: "",
    height: "",
    education: "",
    job: "",
    religion: "",
  });

  const [locationState, setLocationState] = useState<LocationState>({ status: "idle" });
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup all pending timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);

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
            gender: res.data.gender ?? "",
            interestedIn: res.data.interestedIn ?? "",
            height: res.data.height != null ? String(res.data.height) : "",
            education: res.data.education ?? "",
            job: res.data.job ?? "",
            religion: res.data.religion ?? "",
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
          timersRef.current.push(setTimeout(() => setLocationState({ status: "idle" }), 4000));
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
      const heightNum = form.height.trim() ? parseInt(form.height.trim(), 10) : null;
      const res = await apiRequest<ProfileData>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          bio: form.bio.trim(),
          city: form.city.trim(),
          interests: form.interests.trim(),
          gender: form.gender || null,
          interestedIn: form.interestedIn || null,
          height: heightNum,
          education: form.education || null,
          job: form.job.trim() || null,
          religion: form.religion || null,
        }),
      });

      if (!res.success) {
        setError(res.error?.message ?? "Speichern fehlgeschlagen.");
        return;
      }

      setSaveSuccess(true);
      timersRef.current.push(setTimeout(() => setSaveSuccess(false), 3000));
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

          {/* Gender */}
          <label htmlFor="profile-gender">
            Geschlecht
            <select
              id="profile-gender"
              name="gender"
              value={form.gender}
              onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
            >
              <option value="">Bitte wählen</option>
              <option value="mann">Mann</option>
              <option value="frau">Frau</option>
              <option value="divers">Divers</option>
              <option value="keine_angabe">Keine Angabe</option>
            </select>
          </label>

          {/* Interested in */}
          <label htmlFor="profile-interestedIn">
            Interessiert an
            <select
              id="profile-interestedIn"
              name="interestedIn"
              value={form.interestedIn}
              onChange={(e) => setForm((prev) => ({ ...prev, interestedIn: e.target.value }))}
            >
              <option value="">Bitte wählen</option>
              <option value="mann">Männern</option>
              <option value="frau">Frauen</option>
              <option value="beide">Beiden</option>
              <option value="keine_angabe">Keine Angabe</option>
            </select>
          </label>

          {/* Height */}
          <label htmlFor="profile-height">
            Größe (cm)
            <input
              id="profile-height"
              name="height"
              type="number"
              placeholder="z.B. 175"
              min={100}
              max={250}
              value={form.height}
              onChange={(e) => setForm((prev) => ({ ...prev, height: e.target.value }))}
            />
          </label>

          {/* Education */}
          <label htmlFor="profile-education">
            Ausbildung
            <select
              id="profile-education"
              name="education"
              value={form.education}
              onChange={(e) => setForm((prev) => ({ ...prev, education: e.target.value }))}
            >
              <option value="">Bitte wählen</option>
              <option value="ausbildung">Ausbildung</option>
              <option value="abitur">Abitur</option>
              <option value="bachelor">Bachelor</option>
              <option value="master">Master</option>
              <option value="promotion">Promotion</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </label>

          {/* Job */}
          <label htmlFor="profile-job">
            Beruf
            <input
              id="profile-job"
              name="job"
              type="text"
              placeholder="z.B. Softwareentwickler"
              maxLength={120}
              value={form.job}
              onChange={(e) => setForm((prev) => ({ ...prev, job: e.target.value }))}
            />
          </label>

          {/* Religion */}
          <label htmlFor="profile-religion">
            Religion
            <select
              id="profile-religion"
              name="religion"
              value={form.religion}
              onChange={(e) => setForm((prev) => ({ ...prev, religion: e.target.value }))}
            >
              <option value="">Bitte wählen</option>
              <option value="hinduismus">Hinduismus</option>
              <option value="islam">Islam</option>
              <option value="christentum">Christentum</option>
              <option value="sikhismus">Sikhismus</option>
              <option value="kein">Keine Religion</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
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
            <button type="button" className={styles.cancelButton} onClick={() => { if (window.history.length > 1) { router.back(); } else { router.replace("/matches"); } }}>
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
