import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";

export default function PortalForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const slug = localStorage.getItem("portal-slug") ?? "";
  const loginHref = slug ? `/portal/${slug}/login` : "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      await requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/portal/reset-password`,
      });
      setSent(true);
    } catch {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#fff9f9" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #0a0000 0%, #660000 35%, #990000 70%, #cc0000 100%)", flexShrink: 0 }}>
        <div className="flex items-center px-4 sm:px-6" style={{ height: "64px" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-lg px-5 py-1.5" style={{ background: "#ffffff" }}>
              <img src="/wisright-logo.png" alt="Right Tracker" style={{ height: "38px", width: "auto", objectFit: "contain" }} />
            </div>
            <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.3)" }} />
            <span className="text-sm font-bold" style={{ color: "#ffffff", whiteSpace: "nowrap" }}>
              Right Tracker
              <span className="hidden sm:inline font-normal text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>— WisRight Support Tool</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <div style={{ background: "#ffffff", borderRadius: "20px", padding: "40px", boxShadow: "0 4px 24px rgba(204,0,0,0.10), 0 1px 3px rgba(0,0,0,0.05)" }}>
            {/* Gold top bar */}
            <div style={{ height: "4px", background: "linear-gradient(90deg, #0a0000, #ca8a04, #fbbf24)", borderRadius: "4px 4px 0 0", margin: "-40px -40px 32px", borderTopLeftRadius: "20px", borderTopRightRadius: "20px" }} />

            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 style={{ width: "44px", height: "44px", color: "#ca8a04" }} />
                <p style={{ fontWeight: 700, fontSize: "16px", color: "#1a0000", margin: 0 }}>Check your inbox</p>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
                  If an account exists for <span style={{ fontWeight: 600 }}>{email}</span>, a reset link has been sent.
                </p>
                <Link
                  to={loginHref}
                  style={{ fontSize: "13px", color: "#ca8a04", fontWeight: 600, textDecoration: "none", marginTop: "8px" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#990000"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#ca8a04"; }}
                >
                  ← Back to Sign In
                </Link>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "24px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#1a0000", margin: "0 0 6px", letterSpacing: "-0.3px" }}>Forgot Password</h2>
                  <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>Enter your email and we'll send you a reset link.</p>
                </div>

                {error && (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", marginBottom: "20px" }}>
                    ⚠ {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Email address</label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ height: "44px", fontSize: "14px", borderRadius: "10px" }}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{ width: "100%", height: "46px", borderRadius: "10px", marginTop: "8px", background: "linear-gradient(135deg, #0a0000 0%, #990000 50%, #cc0000 100%)", color: "#ffffff", fontWeight: 700, fontSize: "14px", border: "none", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(204,0,0,0.40)", transition: "all 0.2s", opacity: loading ? 0.75 : 1, letterSpacing: "0.02em" }}
                    onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(202,138,4,0.45)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}}
                    onMouseLeave={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(204,0,0,0.40)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}}
                  >
                    {loading ? "Sending…" : "Send Reset Link"}
                  </button>

                  <p style={{ textAlign: "center", fontSize: "13px", color: "#6b7280", margin: "8px 0 0" }}>
                    Remember your password?{" "}
                    <Link
                      to={loginHref}
                      style={{ color: "#ca8a04", fontWeight: 600, textDecoration: "none" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#990000"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#ca8a04"; }}
                    >
                      Sign In
                    </Link>
                  </p>
                </form>
              </>
            )}
          </div>
          <p style={{ marginTop: "24px", textAlign: "center", fontSize: "12px", color: "#9ca3af" }}>Right Tracker · WisRight Internal Platform</p>
        </div>
      </main>
    </div>
  );
}
