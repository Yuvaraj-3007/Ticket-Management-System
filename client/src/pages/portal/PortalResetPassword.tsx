import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { resetPassword } from "@/lib/auth-client";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function PortalResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid or expired reset link.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetErr } = await resetPassword({ newPassword: password, token });
      if (resetErr) {
        setError("This reset link is invalid or has expired. Please request a new one.");
        return;
      }
      navigate("/portal/login", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
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

            {!token ? (
              <div style={{ textAlign: "center", padding: "16px 0" }} className="space-y-3">
                <p style={{ color: "#be123c", fontSize: "14px" }}>Invalid or missing reset token.</p>
                <Link
                  to="/portal/forgot-password"
                  style={{ color: "#ca8a04", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#990000"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#ca8a04"; }}
                >
                  Request a new link
                </Link>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "24px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#1a0000", margin: "0 0 6px", letterSpacing: "-0.3px" }}>Set New Password</h2>
                  <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>Choose a strong password for your account.</p>
                </div>

                {error && (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", marginBottom: "20px" }}>
                    ⚠ {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="new-password" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>New Password</label>
                    <div style={{ position: "relative" }}>
                      <Input
                        id="new-password"
                        type={showPw ? "text" : "password"}
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ height: "44px", fontSize: "14px", paddingRight: "44px", borderRadius: "10px" }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        style={{ position: "absolute", right: 0, top: 0, bottom: 0, padding: "0 14px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                        tabIndex={-1}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm-password" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>Confirm Password</label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repeat your password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
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
                    {loading ? "Saving…" : "Set New Password"}
                  </button>

                  <p style={{ textAlign: "center", fontSize: "13px", color: "#6b7280", margin: "8px 0 0" }}>
                    <Link
                      to="/portal/forgot-password"
                      style={{ color: "#ca8a04", fontWeight: 600, textDecoration: "none" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#990000"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#ca8a04"; }}
                    >
                      Request a new link
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
