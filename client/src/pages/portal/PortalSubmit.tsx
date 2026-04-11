import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { SimpleCaptcha } from "@/components/portal/SimpleCaptcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageUploadField } from "@/components/portal/ImageUploadField";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortalInfo {
  customerName: string;
  slug: string;
}

interface HrmsProject {
  id:          string;
  projectCode: string;
  projectName: string;
}

interface SubmitTicketResponse {
  ticketId: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const submitSchema = z.object({
  name:        z.string().min(1, "Name is required"),
  email:       z.string().email("Valid email required"),
  projectId:   z.string().min(1, "Please select a project"),
  subject:     z.string().min(1, "Subject is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type SubmitFormData = z.infer<typeof submitSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalSubmit() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = useSession();
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken]       = useState<string | undefined>();
  const [captchaAnswer, setCaptchaAnswer]     = useState<string>("");
  const [captchaReset, setCaptchaReset]       = useState(0);

  // Stable callback — prevents SimpleCaptcha from seeing a new onVerify reference
  // every time attachmentFiles changes, which would otherwise retrigger fetchChallenge
  const handleCaptchaVerify = useCallback((verified: boolean, token?: string, answer?: string) => {
    setCaptchaVerified(verified);
    setCaptchaToken(token);
    setCaptchaAnswer(answer ?? "");
  }, []);

  // Derive customer role — but if the slug doesn't match the stored session slug,
  // sign out and show this client's portal form instead.
  const storedSlug   = localStorage.getItem("portal-slug") ?? "";
  const slugMismatch = slug && storedSlug && slug.toLowerCase() !== storedSlug.toLowerCase();
  const customerRole = !sessionPending && session && !slugMismatch
    ? (session.user as unknown as { role?: string }).role
    : null;

  // Auto sign-out when landing on a different client's portal URL
  useEffect(() => {
    if (!sessionPending && session && slugMismatch) {
      signOut().catch(() => null);
    }
  }, [sessionPending, session, slugMismatch]);

  // Fetch portal info (validates slug) — only when not already redirecting
  const {
    data: portalInfo,
    isLoading,
    isError,
    error,
  } = useQuery<PortalInfo>({
    queryKey: ["portal", slug],
    queryFn: async () => {
      const res = await axios.get<PortalInfo>(`/api/portal/${slug}`);
      return res.data;
    },
    enabled: Boolean(slug) && customerRole !== "CUSTOMER",
    retry: false,
  });

  // Fetch projects for this client
  const { data: projects = [], isLoading: projectsLoading } = useQuery<HrmsProject[]>({
    queryKey: ["portal-projects", slug],
    queryFn: async () => {
      const res = await axios.get<HrmsProject[]>(`/api/portal/${slug}/projects`);
      return res.data;
    },
    enabled: Boolean(portalInfo) && customerRole !== "CUSTOMER",
    staleTime: 5 * 60 * 1000,
  });

  // On 404, redirect to /portal/404
  useEffect(() => {
    if (
      isError &&
      axios.isAxiosError(error) &&
      error.response?.status === 404
    ) {
      navigate("/portal/404", { replace: true });
    }
  }, [isError, error, navigate]);

  // Store slug (name-based) and redirect if URL still uses the customer code
  useEffect(() => {
    if (portalInfo && slug) {
      const nameSlug = portalInfo.customerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      localStorage.setItem("portal-slug", nameSlug);
      localStorage.setItem("portal-client-id", (portalInfo as unknown as { id?: string }).id ?? "");
      // Redirect C1396 → missing-connectz style URL
      if (nameSlug && nameSlug !== slug.toLowerCase()) {
        navigate(`/portal/${nameSlug}`, { replace: true });
      }
    }
  }, [portalInfo, slug, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmitFormData>({
    resolver: zodResolver(submitSchema),
    mode: "onBlur",
  });

  const mutation = useMutation<SubmitTicketResponse, unknown, SubmitFormData>({
    mutationFn: async (data) => {
      const selectedProject = projects.find((p) => p.id === data.projectId);
      const fd = new FormData();
      fd.append("name",        data.name);
      fd.append("email",       data.email);
      fd.append("subject",     data.subject);
      fd.append("body",        data.description);
      fd.append("projectId",   data.projectId);
      fd.append("projectName",  selectedProject?.projectName ?? "");
      fd.append("captchaToken",  captchaToken  ?? "");
      fd.append("captchaAnswer", captchaAnswer ?? "");
      for (const file of attachmentFiles) {
        fd.append("attachments", file);
      }
      const res = await axios.post<SubmitTicketResponse>(
        `/api/portal/${slug}/tickets`,
        fd
      );
      return res.data;
    },
    onSuccess: (data, variables) => {
      setAttachmentFiles([]);
      setCaptchaVerified(false);
      setCaptchaToken(undefined);
      setCaptchaAnswer("");
      setCaptchaReset((n) => n + 1);
      navigate(`/portal/${slug}/login`, {
        replace: true,
        state: {
          ticketId:  data.ticketId,
          name:      variables.name,
          email:     variables.email,
          isNewUser: true,
        },
      });
    },
    onError: () => {
      // Always refresh the CAPTCHA on failure so the stale/expired token
      // doesn't block every subsequent retry
      setCaptchaVerified(false);
      setCaptchaToken(undefined);
      setCaptchaAnswer("");
      setCaptchaReset((n) => n + 1);
    },
  });

  const onSubmit = (data: SubmitFormData) => {
    mutation.mutate(data);
  };

  // If already logged in as CUSTOMER, redirect straight to tickets (after all hooks)
  if (customerRole === "CUSTOMER") {
    return <Navigate to="/portal/tickets" replace />;
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading portal...</p>
      </div>
    );
  }

  // Non-404 error
  if (isError && !axios.isAxiosError(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500">Something went wrong. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--rt-bg)" }}>
      {/* Top navbar */}
      <header
        style={{
          background:   "var(--rt-accent)",
          borderBottom: "none",
          flexShrink:   0,
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-6" style={{ height: "56px" }}>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-lg px-5 py-1.5" style={{ background: "#ffffff" }}>
              <img
                src="/wisright-logo.png"
                alt="Right Tracker"
                style={{ height: "38px", width: "auto", objectFit: "contain" }}
              />
            </div>
            <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.3)" }} />
            <span className="text-sm font-bold" style={{ color: "#ffffff", whiteSpace: "nowrap" }}>
              Right Tracker
              <span className="hidden sm:inline font-normal text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>— WisRight's Support Tool</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/portal/${slug}/login`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
              style={{ color: "#ffffff", border: "1px solid rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.12)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.22)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.12)"; }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--rt-text-1)" }}>
            Submit a Support Request
          </h1>
          {portalInfo && (
            <p style={{ color: "var(--rt-text-2)" }}>
              You are contacting{" "}
              <span className="font-medium" style={{ color: "var(--rt-text-1)" }}>
                {portalInfo.customerName}
              </span>{" "}
              support.
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Ticket</CardTitle>
            <CardDescription>
              Fill in the details below and we will get back to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Your full name"
                    {...register("name")}
                    className={errors.name ? "border-red-400" : ""}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs">{errors.name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...register("email")}
                    className={errors.email ? "border-red-400" : ""}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs">{errors.email.message}</p>
                  )}
                </div>

                {/* Project */}
                <div className="space-y-1.5">
                  <Label htmlFor="projectId">Project</Label>
                  <select
                    id="projectId"
                    {...register("projectId")}
                    disabled={projectsLoading}
                    className={`w-full h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${errors.projectId ? "border-red-400" : "border-input"}`}
                  >
                    <option value="">
                      {projectsLoading ? "Loading projects…" : "Select a project"}
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectName}
                      </option>
                    ))}
                  </select>
                  {errors.projectId && (
                    <p className="text-red-500 text-xs">{errors.projectId.message}</p>
                  )}
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief summary of the issue"
                    {...register("subject")}
                    className={errors.subject ? "border-red-400" : ""}
                  />
                  {errors.subject && (
                    <p className="text-red-500 text-xs">{errors.subject.message}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue in detail (minimum 10 characters)"
                    rows={5}
                    {...register("description")}
                    className={errors.description ? "border-red-400" : ""}
                  />
                  {errors.description && (
                    <p className="text-red-500 text-xs">
                      {errors.description.message}
                    </p>
                  )}
                </div>

                {/* Attachments */}
                <ImageUploadField files={attachmentFiles} onChange={setAttachmentFiles} />

                {/* Simple CAPTCHA */}
                <SimpleCaptcha
                  onVerify={handleCaptchaVerify}
                  reset={captchaReset}
                />

                {/* Server error */}
                {mutation.isError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md">
                    {axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
                      ? mutation.error.response.data.error
                      : "Failed to submit ticket. Please try again."}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={mutation.isPending || !captchaVerified}
                >
                  {mutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
            </form>

            {/* Login link */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{" "}
              <Link
                to={`/portal/${slug}/login`}
                className="text-blue-600 hover:underline font-medium"
              >
                Sign in to track your tickets
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
