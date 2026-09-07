export const metadata = { title: "Offline", robots: { index: false } };

export default function Offline() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center",
                   background: "var(--midnight)", color: "#e8eef7", padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <h1 style={{ color: "#fff" }}>You&rsquo;re offline.</h1>
        <p style={{ color: "#bccbe0" }}>
          Your workspace needs a connection, so it isn&rsquo;t shown from a stale cache — a page
          showing yesterday&rsquo;s draft would be worse than this notice.
        </p>
        <p style={{ color: "#8fa3c0", fontSize: ".92rem" }}>
          Anything you captured while offline is saved on this device and sends itself when you
          reconnect.
        </p>
        <p style={{ marginTop: 26 }}>
          <a className="btn btn-primary" href="/app/mobile">Try again</a>
        </p>
      </div>
    </main>
  );
}
