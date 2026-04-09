import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--rt-bg)" }}>
      {/* Header */}
      <header style={{ background: "var(--rt-accent)", flexShrink: 0 }}>
        <div className="flex items-center px-4 sm:px-6" style={{ height: "56px" }}>
          <div className="flex items-center gap-2.5">
            <img src="/wisright-logo.png" alt="Right Tracker" style={{ height: "26px", width: "auto", objectFit: "contain" }} />
            <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.3)" }} />
            <span className="text-sm font-bold tracking-tight" style={{ color: "#ffffff" }}>
              Right <span style={{ color: "rgba(255,255,255,0.75)" }}>Tracker</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-1" style={{ background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.85)" }}>
              Customer Portal
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-lg">Forgot Password</CardTitle>
            <CardDescription className="text-center">
              Enter your email and we will send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="font-semibold text-gray-800">Check your inbox</p>
                <p className="text-sm text-gray-500">
                  If an account exists for <span className="font-medium">{email}</span>, a reset link has been sent.
                </p>
                <Link to={loginHref} className="text-sm text-blue-600 hover:underline mt-2">
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <p className="text-center text-sm text-gray-500">
                  Remember your password?{" "}
                  <Link to={loginHref} className="text-blue-600 hover:underline font-medium">
                    Sign In
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
