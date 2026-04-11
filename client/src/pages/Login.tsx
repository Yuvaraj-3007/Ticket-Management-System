import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function Login() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError("");

    const { error } = await signIn.email({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setServerError(error.message || "Invalid email or password");
      return;
    }

    navigate("/");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Left branding panel — RCB black & red */}
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
            Support Ticket Management Platform
          </p>
          {/* Gold underline */}
          <div style={{ width:"60px", height:"3px", background:"linear-gradient(90deg, #ca8a04, #fbbf24)", borderRadius:"2px", margin:"0 auto 18px" }} />
          <p style={{ color:"rgba(255,255,255,0.72)", fontSize:"14px", lineHeight:1.7, margin:"0 0 28px" }}>
            One platform to receive, assign, track and resolve all client support requests — from submission to closure.
          </p>

        </div>

      </div>

      {/* Right form panel */}
      <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-12" style={{ flex:1, background:"#fff9f9" }}>
        <div style={{ width:"100%", maxWidth:"400px" }}>
          <div className="flex justify-center mb-8 md:hidden">
            <img src="/wisright-logo.png" alt="Right Tracker" style={{ height:"44px" }} />
          </div>

          <div style={{ background:"#ffffff", borderRadius:"20px", padding:"40px", boxShadow:"0 4px 24px rgba(204,0,0,0.10), 0 1px 3px rgba(0,0,0,0.05)" }}>
            {/* Gold top bar */}
            <div style={{ height:"4px", background:"linear-gradient(90deg, #0a0000, #ca8a04, #fbbf24)", borderRadius:"4px 4px 0 0", margin:"-40px -40px 32px", borderTopLeftRadius:"20px", borderTopRightRadius:"20px" }} />

            <div style={{ marginBottom:"28px" }}>
              <h2 style={{ fontSize:"24px", fontWeight:800, color:"#1a0000", margin:"0 0 6px", letterSpacing:"-0.3px" }}>Welcome back</h2>
              <p style={{ color:"#6b7280", fontSize:"14px", margin:0 }}>Sign in to manage tickets and support requests.</p>
            </div>

            {serverError && (
              <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", color:"#be123c", borderRadius:"10px", padding:"10px 14px", fontSize:"13px", marginBottom:"20px" }}>
                ⚠ {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
              <div>
                <label htmlFor="email" style={{ display:"block", fontSize:"13px", fontWeight:600, color:"#374151", marginBottom:"6px" }}>Email address</label>
                <Input id="email" type="email" placeholder="you@wisright.com" {...register("email")} style={{ height:"44px", fontSize:"14px", borderRadius:"10px" }} className={errors.email ? "border-red-400" : ""} />
                {errors.email && <p style={{ color:"#be123c", fontSize:"12px", marginTop:"4px" }}>{errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="password" style={{ display:"block", fontSize:"13px", fontWeight:600, color:"#374151", marginBottom:"6px" }}>Password</label>
                <div style={{ position:"relative" }}>
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" {...register("password")} style={{ height:"44px", fontSize:"14px", paddingRight:"44px", borderRadius:"10px" }} className={errors.password ? "border-red-400" : ""} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position:"absolute", right:0, top:0, bottom:0, padding:"0 14px", background:"none", border:"none", cursor:"pointer", color:"#94a3b8" }} tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p style={{ color:"#be123c", fontSize:"12px", marginTop:"4px" }}>{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={isSubmitting}
                style={{ width:"100%", height:"46px", borderRadius:"10px", marginTop:"8px", background:"linear-gradient(135deg, #0a0000 0%, #990000 50%, #cc0000 100%)", color:"#ffffff", fontWeight:700, fontSize:"14px", border:"none", cursor:isSubmitting ? "not-allowed" : "pointer", boxShadow:"0 4px 16px rgba(204,0,0,0.40)", transition:"all 0.2s", opacity:isSubmitting ? 0.75 : 1, letterSpacing:"0.02em" }}
                onMouseEnter={(e) => { if (!isSubmitting) { (e.currentTarget as HTMLElement).style.boxShadow="0 4px 20px rgba(202,138,4,0.45)"; (e.currentTarget as HTMLElement).style.transform="translateY(-1px)"; }}}
                onMouseLeave={(e) => { if (!isSubmitting) { (e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(204,0,0,0.40)"; (e.currentTarget as HTMLElement).style.transform="translateY(0)"; }}}>
                {isSubmitting ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>
          <p style={{ marginTop:"24px", textAlign:"center", fontSize:"12px", color:"#9ca3af" }}>Right Tracker · WisRight Internal Platform</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
