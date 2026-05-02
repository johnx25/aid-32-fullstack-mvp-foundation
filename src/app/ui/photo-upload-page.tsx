"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./photo-upload-page.module.css";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

type Photo = {
  id: number;
  url: string;
  sortOrder: number;
  createdAt: string;
};

type UploadState = { status: "idle" } | { status: "uploading"; name: string } | { status: "error"; message: string };

export function PhotoUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchPhotos() {
      try {
        const res = await fetch("/api/profile/photos");
        if (!mounted) return;
        if (res.status === 401) { router.replace("/login"); return; }
        if (!res.ok) return;
        const body = await res.json() as { success: boolean; data?: Photo[] };
        if (body.success && body.data) setPhotos(body.data);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    fetchPhotos();
    return () => { mounted = false; };
  }, [router]);


  async function uploadFile(file: File) {
    // Client-side validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadState({ status: "error", message: `"${file.name}": Nur JPG und PNG erlaubt.` });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadState({ status: "error", message: `"${file.name}": Datei ist zu groß (max. 8 MB).` });
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      setUploadState({ status: "error", message: `Maximal ${MAX_PHOTOS} Bilder erlaubt.` });
      return;
    }

    setUploadState({ status: "uploading", name: file.name });

    const form = new FormData();
    form.append("photo", file);

    try {
      const res = await fetch("/api/profile/photos", { method: "POST", body: form });
      const body = await res.json() as { success: boolean; data?: Photo; error?: { message: string } };

      if (!body.success) {
        setUploadState({ status: "error", message: body.error?.message ?? "Upload fehlgeschlagen." });
        return;
      }

      if (body.data) setPhotos((prev) => [...prev, body.data!].sort((a, b) => a.sortOrder - b.sortOrder));
      setUploadState({ status: "idle" });
    } catch {
      setUploadState({ status: "error", message: "Verbindungsfehler beim Upload." });
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    for (const file of files) {
      await uploadFile(file);
    }
  }

  async function handleDelete(photoId: number) {
    setDeletingId(photoId);
    try {
      await fetch(`/api/profile/photos/${photoId}`, { method: "DELETE" });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } finally {
      setDeletingId(null);
    }
  }

  // Drag & Drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave() { setIsDragging(false); }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadFile(file);
    }
  }

  const canContinue = photos.length >= MIN_PHOTOS;
  const isUploading = uploadState.status === "uploading";

  if (isLoading) {
    return <main className={styles.page}><p className={styles.loading}>Lädt…</p></main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <h1>Deine Fotos</h1>
          <p className={styles.subtitle}>
            Lade mindestens <strong>{MIN_PHOTOS}</strong> Bilder hoch, damit andere dich sehen können.
          </p>
          <div className={styles.progress}>
            <div
              className={styles.progressBar}
              style={{ width: `${Math.min((photos.length / MIN_PHOTOS) * 100, 100)}%` }}
            />
          </div>
          <p className={styles.progressLabel}>
            {photos.length} / {MIN_PHOTOS} Pflicht-Fotos
            {photos.length >= MIN_PHOTOS ? " ✓" : ""}
          </p>
        </header>

        {/* Drop zone */}
        <div
          className={`${styles.dropZone} ${isDragging ? styles.dragging : ""} ${isUploading ? styles.uploading : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Bilder hier ablegen oder klicken zum Auswählen"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            multiple
            className={styles.hiddenInput}
            onChange={handleFileSelect}
            disabled={isUploading || photos.length >= MAX_PHOTOS}
          />
          {isUploading ? (
            <div className={styles.dropContent}>
              <span className={styles.dropIcon}>⏳</span>
              <p>Wird hochgeladen: {(uploadState as { name: string }).name}</p>
            </div>
          ) : (
            <div className={styles.dropContent}>
              <span className={styles.dropIcon}>📷</span>
              <p><strong>Klicken oder hierher ziehen</strong></p>
              <p className={styles.dropHint}>JPG oder PNG · max. 8 MB pro Bild</p>
            </div>
          )}
        </div>

        {/* Error */}
        {uploadState.status === "error" && (
          <p className={styles.error}>{uploadState.message}</p>
        )}

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className={styles.grid}>
            {photos.map((photo, idx) => (
              <div key={photo.id} className={styles.photoCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Foto ${idx + 1}`} className={styles.photo} />
                {idx === 0 && <span className={styles.mainBadge}>Hauptfoto</span>}
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(photo.id)}
                  disabled={deletingId === photo.id}
                  aria-label={`Foto ${idx + 1} löschen`}
                >
                  {deletingId === photo.id ? "…" : "✕"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hint */}
        <p className={styles.hint}>
          Das erste Foto wird als Profilbild angezeigt. Maximal {MAX_PHOTOS} Bilder.
        </p>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => router.back()}
          >
            Zurück
          </button>
          <button
            type="button"
            className={styles.continueButton}
            disabled={!canContinue}
            onClick={() => router.push("/matches")}
            title={!canContinue ? `Bitte noch ${MIN_PHOTOS - photos.length} Foto(s) hochladen` : undefined}
          >
            {canContinue ? "Weiter zu den Matches →" : `Noch ${MIN_PHOTOS - photos.length} Foto(s) nötig`}
          </button>
        </div>
      </section>
    </main>
  );
}
