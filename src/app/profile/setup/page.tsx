export default function ProfileSetupPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <section style={{ maxWidth: 640, width: "100%", border: "1px solid #d8e1ef", borderRadius: 20, padding: "2rem", background: "white" }}>
        <p style={{ margin: 0, color: "#52637d", fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Profile Setup
        </p>
        <h1 style={{ marginTop: "0.75rem", marginBottom: "0.75rem", fontSize: "2rem" }}>Account created successfully</h1>
        <p style={{ margin: 0, color: "#41526d", lineHeight: 1.6 }}>
          This page is intentionally empty for now. Next we’ll ask the remaining profile questions here.
        </p>
      </section>
    </main>
  );
}
