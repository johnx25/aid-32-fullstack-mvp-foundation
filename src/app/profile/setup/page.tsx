import Link from "next/link";

export default function ProfileSetupPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <section style={{ maxWidth: 560, width: "100%", border: "1px solid #d8e1ef", borderRadius: 20, padding: "2rem", background: "white", display: "grid", gap: "1rem" }}>
        <p style={{ margin: 0, color: "#52637d", fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Account erstellt
        </p>
        <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#10131f" }}>
          Willkommen! 🎉
        </h1>
        <p style={{ margin: 0, color: "#41526d", lineHeight: 1.6 }}>
          Dein Account wurde erfolgreich erstellt. Vervollständige jetzt dein Profil, damit andere dich finden können.
        </p>
        <Link
          href="/profile/edit"
          style={{
            display: "inline-block",
            background: "var(--primary-color, #e87722)",
            color: "#fff",
            fontWeight: 700,
            padding: "0.75rem 1.4rem",
            borderRadius: 12,
            textDecoration: "none",
            textAlign: "center",
            fontSize: "1rem",
          }}
        >
          Profil jetzt einrichten →
        </Link>
        <Link
          href="/matches"
          style={{ textAlign: "center", color: "#41526d", fontSize: "0.9rem" }}
        >
          Überspringen
        </Link>
      </section>
    </main>
  );
}
