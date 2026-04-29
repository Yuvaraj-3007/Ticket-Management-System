import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useSession, signIn } from "@/lib/auth-client";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginState {
  ticketId?:  string;
  name?:      string;
  email?:     string;
  isNewUser?: boolean;
}

interface PortalInfo {
  customerName: string;
  slug:         string;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email:    z.string().email("Valid email required"),
  password: z.string().min(1, "Password is required"),
});

const signUpSchema = z.object({
  name:            z.string().min(1, "Name is required").max(128),
  email:           z.string().email("Valid email required"),
  password:        z.string().min(8, "At least 8 characters").max(128),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path:    ["confirmPassword"],
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

// ─── Sub-forms ────────────────────────────────────────────────────────────────

function SignInForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: "onBlur",
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = async (data: SignInFormData) => {
    setServerError("");
    const { error } = await signIn.email({
      email:       data.email,
      password:    data.password,
      callbackURL: "/portal/dashboard",
    });

    if (error) {
      setServerError("Invalid email or password");
      return;
    }

    // Bind this customer to the portal they're signing into
    const clientId = localStorage.getItem("portal-client-id");
    if (clientId) {
      await axios.patch("/api/portal/me/client", { clientId }, { withCredentials: true }).catch(() => null);
    }

    navigate("/portal/dashboard", { replace: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
      {serverError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/30 text-sm p-3 rounded-md">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          placeholder="you@example.com"
          {...register("email")}
          className={errors.email ? "border-red-400" : ""}
        />
        {errors.email && (
          <p className="text-red-500 text-xs">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          <Link
            to="/portal/forgot-password"
            style={{ fontSize:"12px", color:"#ca8a04", fontWeight:600, textDecoration:"none" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#990000"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#ca8a04"; }}
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="signin-password"
            type={showPw ? "text" : "password"}
            placeholder="Your password"
            {...register("password")}
            className={errors.password ? "border-red-400 pr-10" : "pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-red-500 text-xs">{errors.password.message}</p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}
        style={{ width:"100%", height:"44px", borderRadius:"10px", marginTop:"4px", background:"linear-gradient(135deg, #0a0000 0%, #990000 50%, #cc0000 100%)", color:"#ffffff", fontWeight:700, fontSize:"14px", border:"none", cursor:isSubmitting ? "not-allowed" : "pointer", boxShadow:"0 4px 16px rgba(204,0,0,0.35)", transition:"all 0.2s", opacity:isSubmitting ? 0.75 : 1 }}
        onMouseEnter={(e) => { if (!isSubmitting) { (e.currentTarget as HTMLElement).style.boxShadow="0 4px 20px rgba(202,138,4,0.4)"; (e.currentTarget as HTMLElement).style.transform="translateY(-1px)"; }}}
        onMouseLeave={(e) => { if (!isSubmitting) { (e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(204,0,0,0.35)"; (e.currentTarget as HTMLElement).style.transform="translateY(0)"; }}}>
        {isSubmitting ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

function SignUpForm({ defaultName = "", defaultEmail = "", clientId = "" }: { defaultName?: string; defaultEmail?: string; clientId?: string }) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: "onBlur",
    defaultValues: { name: defaultName, email: defaultEmail },
  });

  const onSubmit = async (data: SignUpFormData) => {
    setServerError("");

    try {
      await axios.post("/api/portal/auth/signup", {
        name:     data.name,
        email:    data.email,
        password: data.password,
        ...(clientId ? { clientId } : {}),
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setServerError("An account with this email already exists");
      } else {
        setServerError("Failed to create account. Please try again.");
      }
      return;
    }

    const { error } = await signIn.email({
      email:       data.email,
      password:    data.password,
      callbackURL: "/portal/dashboard",
    });

    if (error) {
      setServerError("Account created but sign-in failed. Please sign in manually.");
      return;
    }

    // Bind this customer to the portal they signed up through
    if (clientId) {
      await axios.patch("/api/portal/me/client", { clientId }, { withCredentials: true }).catch(() => null);
    }

    navigate("/portal/dashboard", { replace: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
      {serverError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/30 text-sm p-3 rounded-md">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="signup-name">Name</Label>
        <Input
          id="signup-name"
          placeholder="Your full name"
          {...register("name")}
          className={errors.name ? "border-red-400" : ""}
        />
        {errors.name && (
          <p className="text-red-500 text-xs">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          {...register("email")}
          className={errors.email ? "border-red-400" : ""}
        />
        {errors.email && (
          <p className="text-red-500 text-xs">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-password">New Password</Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPw ? "text" : "password"}
            placeholder="At least 8 characters"
            {...register("password")}
            className={errors.password ? "border-red-400 pr-10" : "pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-red-500 text-xs">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-confirm-password">Confirm Password</Label>
        <div className="relative">
          <Input
            id="signup-confirm-password"
            type={showConfirmPw ? "text" : "password"}
            placeholder="Re-enter your password"
            {...register("confirmPassword")}
            className={errors.confirmPassword ? "border-red-400 pr-10" : "pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-red-500 text-xs">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}
        style={{ width:"100%", height:"44px", borderRadius:"10px", marginTop:"4px", background:"linear-gradient(135deg, #0a0000 0%, #990000 50%, #cc0000 100%)", color:"#ffffff", fontWeight:700, fontSize:"14px", border:"none", cursor:isSubmitting ? "not-allowed" : "pointer", boxShadow:"0 4px 16px rgba(204,0,0,0.35)", transition:"all 0.2s", opacity:isSubmitting ? 0.75 : 1 }}
        onMouseEnter={(e) => { if (!isSubmitting) { (e.currentTarget as HTMLElement).style.boxShadow="0 4px 20px rgba(202,138,4,0.4)"; (e.currentTarget as HTMLElement).style.transform="translateY(-1px)"; }}}
        onMouseLeave={(e) => { if (!isSubmitting) { (e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(204,0,0,0.35)"; (e.currentTarget as HTMLElement).style.transform="translateY(0)"; }}}>
        {isSubmitting ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "signin" | "signup";

export default function PortalLogin() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session, isPending } = useSession();
  const location   = useLocation();
  const navigate   = useNavigate();
  const fromSubmit = (location.state ?? {}) as LoginState;

  const [activeTab, setActiveTab] = useState<Tab>(
    fromSubmit.isNewUser ? "signup" : "signin"
  );

  // Fetch portal info to show client name and redirect to name-based URL
  const { data: portalInfo } = useQuery<PortalInfo>({
    queryKey: ["portal", slug],
    queryFn:  async () => {
      const res = await axios.get<PortalInfo>(`/api/portal/${slug}`);
      return res.data;
    },
    enabled:  Boolean(slug),
    retry:    false,
    staleTime: 5 * 60 * 1000,
  });

  // Redirect C1396-style slug → missing-connectz style
  useEffect(() => {
    if (portalInfo && slug) {
      const nameSlug = portalInfo.customerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      localStorage.setItem("portal-slug", nameSlug);
      // Store the HRMS client ID so signup can bind the account to this client
      const clientId = (portalInfo as unknown as { id?: string }).id;
      if (clientId) localStorage.setItem("portal-client-id", clientId);
      if (nameSlug && nameSlug !== slug.toLowerCase()) {
        navigate(`/portal/${nameSlug}/login`, { replace: true, state: location.state });
      }
    }
  }, [portalInfo, slug, navigate, location.state]);

  if (!isPending && session) {
    const role = (session.user as unknown as { role?: string }).role;
    if (role === "CUSTOMER") {
      return <Navigate to="/portal/dashboard" replace />;
    }
  }

  const storedClientId = localStorage.getItem("portal-client-id") ?? "";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* ── Left branding panel — same RCB theme as admin login ── */}
      <div
        className="hidden md:flex flex-col items-center justify-center"
        style={{
          width: "45%", flexShrink: 0,
          background: "linear-gradient(160deg, #0a0000 0%, #660000 30%, #990000 65%, #cc0000 100%)",
          padding: "48px", position: "relative", overflow: "hidden",
        }}
      >
        {/* Gold decorative rings */}
        <div style={{ position:"absolute", top:"-60px", right:"-60px", width:"260px", height:"260px", borderRadius:"50%", border:"2px solid rgba(202,138,4,0.25)", background:"transparent" }} />
        <div style={{ position:"absolute", top:"-40px", right:"-40px", width:"200px", height:"200px", borderRadius:"50%", border:"1px solid rgba(202,138,4,0.15)", background:"transparent" }} />
        <div style={{ position:"absolute", bottom:"-80px", left:"-40px", width:"240px", height:"240px", borderRadius:"50%", border:"2px solid rgba(202,138,4,0.20)", background:"transparent" }} />

        <div style={{ position:"relative", zIndex:1, textAlign:"center", maxWidth:"360px" }}>
          {/* Logo */}
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.95)", borderRadius:"20px", padding:"20px 32px", marginBottom:"32px", boxShadow:"0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px rgba(202,138,4,0.4)" }}>
            <img src="/wisright-logo.png" alt="WisRight" style={{ height:"52px", width:"auto" }} />
          </div>

          <h1 style={{ color:"#ffffff", fontSize:"30px", fontWeight:800, margin:"0 0 6px", letterSpacing:"-0.5px" }}>
            Right Tracker
          </h1>
          <p style={{ color:"rgba(202,138,4,0.9)", fontSize:"12px", fontWeight:600, letterSpacing:"0.12em", margin:"0 0 12px", textTransform:"uppercase" }}>
            Customer Portal
          </p>
          {/* Gold underline */}
          <div style={{ width:"60px", height:"3px", background:"linear-gradient(90deg, #ca8a04, #fbbf24)", borderRadius:"2px", margin:"0 auto 18px" }} />

          <p style={{ color:"rgba(255,255,255,0.72)", fontSize:"14px", lineHeight:1.7, margin:"0 0 28px" }}>
            Submit, track and follow up on your support requests — all in one place.
          </p>

          {portalInfo?.customerName && (
            <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:"12px", padding:"14px 20px", border:"1px solid rgba(202,138,4,0.30)", marginBottom:"8px" }}>
              <p style={{ color:"rgba(255,255,255,0.55)", fontSize:"11px", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", margin:"0 0 4px" }}>You are accessing</p>
              <p style={{ color:"#fbbf24", fontSize:"16px", fontWeight:700, margin:0 }}>{portalInfo.customerName}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-col items-center justify-center" style={{ flex:1, background:"#fff9f9" }}>

        {/* Mobile-only red branding header */}
        <div
          className="flex md:hidden flex-col items-center justify-center w-full"
          style={{
            background: "linear-gradient(160deg, #0a0000 0%, #660000 30%, #990000 65%, #cc0000 100%)",
            padding: "32px 24px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position:"absolute", top:"-40px", right:"-40px", width:"180px", height:"180px", borderRadius:"50%", border:"2px solid rgba(202,138,4,0.25)", background:"transparent" }} />
          <div style={{ position:"absolute", bottom:"-40px", left:"-30px", width:"160px", height:"160px", borderRadius:"50%", border:"2px solid rgba(202,138,4,0.20)", background:"transparent" }} />

          <div style={{ position:"relative", zIndex:1, textAlign:"center" }}>
            <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.95)", borderRadius:"16px", padding:"14px 24px", marginBottom:"20px", boxShadow:"0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px rgba(202,138,4,0.4)" }}>
              <img src="/wisright-logo.png" alt="Right Tracker" style={{ height:"40px", width:"auto" }} />
            </div>
            <h1 style={{ color:"#ffffff", fontSize:"22px", fontWeight:800, margin:"0 0 4px", letterSpacing:"-0.3px" }}>Right Tracker</h1>
            <p style={{ color:"rgba(202,138,4,0.9)", fontSize:"11px", fontWeight:600, letterSpacing:"0.12em", margin:"0 0 10px", textTransform:"uppercase" }}>
              Customer Portal
            </p>
            <div style={{ width:"48px", height:"3px", background:"linear-gradient(90deg, #ca8a04, #fbbf24)", borderRadius:"2px", margin:"0 auto" }} />
            {portalInfo?.customerName && (
              <p style={{ color:"rgba(255,255,255,0.85)", fontSize:"13px", fontWeight:600, marginTop:"12px" }}>{portalInfo.customerName}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-12 w-full" style={{ flex:1 }}>
        <div style={{ width:"100%", maxWidth:"420px" }}>

          {/* Success banner */}
          {fromSubmit.ticketId && (
            <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", display:"flex", alignItems:"flex-start", gap:"10px" }}>
              <span style={{ color:"#16a34a", fontSize:"16px" }}>✓</span>
              <div>
                <p style={{ color:"#15803d", fontWeight:600, fontSize:"13px", margin:"0 0 2px" }}>
                  Ticket <span style={{ fontFamily:"monospace" }}>{fromSubmit.ticketId}</span> submitted!
                </p>
                <p style={{ color:"#166534", fontSize:"12px", margin:0 }}>
                  {fromSubmit.isNewUser ? "Create an account to track your ticket status online." : "Sign in to view and track your ticket."}
                </p>
              </div>
            </div>
          )}

          <div style={{ background:"#ffffff", borderRadius:"20px", padding:"clamp(24px, 5vw, 40px)", boxShadow:"0 4px 24px rgba(204,0,0,0.10), 0 1px 3px rgba(0,0,0,0.05)" }}>
            {/* Gold top bar */}
            <div style={{ height:"4px", background:"linear-gradient(90deg, #0a0000, #990000, #cc0000)", margin:"calc(-1 * clamp(24px, 5vw, 40px)) calc(-1 * clamp(24px, 5vw, 40px)) 32px", borderTopLeftRadius:"20px", borderTopRightRadius:"20px" }} />

            <div style={{ marginBottom:"24px" }}>
              <h2 style={{ fontSize:"22px", fontWeight:800, color:"#1a0000", margin:"0 0 4px", letterSpacing:"-0.3px" }}>
                {activeTab === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p style={{ color:"#6b7280", fontSize:"13px", margin:0 }}>
                {portalInfo?.customerName
                  ? `${activeTab === "signin" ? "Sign in to" : "Register for"} ${portalInfo.customerName} support portal`
                  : "Access your support ticket portal"}
              </p>
            </div>

            {/* Tabs — only shown after ticket submission */}
            {fromSubmit.isNewUser && (
              <div style={{ display:"flex", background:"#f3f4f6", borderRadius:"10px", padding:"4px", marginBottom:"24px", gap:"4px" }}>
                {(["signin", "signup"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex:1, padding:"8px", borderRadius:"8px", border:"none", cursor:"pointer",
                      fontSize:"13px", fontWeight:600, transition:"all 0.15s",
                      background: activeTab === tab ? "#ffffff" : "transparent",
                      color: activeTab === tab ? "#1a0000" : "#6b7280",
                      boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    {tab === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>
            )}

            {activeTab === "signin"
              ? <SignInForm defaultEmail={fromSubmit.email ?? ""} />
              : <SignUpForm defaultName={fromSubmit.name ?? ""} defaultEmail={fromSubmit.email ?? ""} clientId={storedClientId} />
            }

            <div style={{ marginTop:"20px", paddingTop:"16px", borderTop:"1px solid #f3f4f6", textAlign:"center" }}>
              <Link
                to={`/portal/${slug}/submit`}
                style={{ fontSize:"13px", color:"#990000", textDecoration:"none", fontWeight:500 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
              >
                Submit your First Ticket here →
              </Link>
            </div>
          </div>

          <p style={{ marginTop:"24px", textAlign:"center", fontSize:"12px", color:"#9ca3af" }}>
            Right Tracker · WisRight Customer Portal
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
