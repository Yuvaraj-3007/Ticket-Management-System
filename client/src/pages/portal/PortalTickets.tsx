import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { SimpleCaptcha } from "@/components/portal/SimpleCaptcha";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUploadField } from "@/components/portal/ImageUploadField";
import { Search, LayoutList, LayoutGrid, ArrowUpDown, SlidersHorizontal, X, Plus } from "lucide-react";
import { TICKET_TYPE, type TicketTypeValue } from "@tms/core";

// ─── Types ────────────────────────────────────────────────────────────────────

type PortalTicket = {
  id:        string;
  ticketId:  string;
  title:     string;
  status:    string;
  priority:  string;
  type?:     TicketTypeValue;
  createdAt: string;
  updatedAt: string;
  rating:    number | null;
};

// Tab filter buckets — drives the type[] sent to GET /api/portal/tickets
type TabFilter = "all" | "bug" | "impl" | "reopened";
const BUG_TYPES: readonly TicketTypeValue[] = [
  TICKET_TYPE.BUG,
  TICKET_TYPE.REQUIREMENT,
  TICKET_TYPE.TASK,
  TICKET_TYPE.SUPPORT,
  TICKET_TYPE.EXPLANATION,
];
const IMPL_TYPES: readonly TicketTypeValue[] = [TICKET_TYPE.IMPLEMENTATION];

interface TicketsResponse {
  data:       PortalTicket[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

type StatusFilter   = "" | "UN_ASSIGNED" | "OPEN_NOT_STARTED" | "OPEN_IN_PROGRESS" | "OPEN_QA" | "OPEN_DONE" | "WAITING_FOR_CLIENT" | "CLOSED" | "SUBMITTED" | "ADMIN_REVIEW" | "PLANNING" | "CUSTOMER_APPROVAL" | "APPROVED" | "REOPENED";
type SortOrder      = "desc" | "asc";
type ViewMode       = "list" | "grid";

// ─── Status / Priority config ─────────────────────────────────────────────────

type StatusOption = { value: StatusFilter; label: string };

// Statuses that only apply to bug/support tickets
const BUG_STATUS_OPTIONS: StatusOption[] = [
  { value: "",                    label: "All"               },
  { value: "UN_ASSIGNED",         label: "Un-Assigned"       },
  { value: "OPEN_NOT_STARTED",    label: "Not Started"       },
  { value: "OPEN_IN_PROGRESS",    label: "In Progress"       },
  { value: "OPEN_QA",             label: "QA"                },
  { value: "OPEN_DONE",           label: "Done"              },
  { value: "WAITING_FOR_CLIENT",  label: "Waiting for Client"},
  { value: "CLOSED",              label: "Closed"            },
];

// Statuses that only apply to implementation tickets
const IMPL_STATUS_OPTIONS: StatusOption[] = [
  { value: "",                    label: "All"               },
  { value: "SUBMITTED",           label: "Submitted"         },
  { value: "ADMIN_REVIEW",        label: "In Review"         },
  { value: "PLANNING",            label: "Planning"          },
  { value: "CUSTOMER_APPROVAL",   label: "Awaiting Approval" },
  { value: "APPROVED",            label: "Approved"          },
  { value: "OPEN_IN_PROGRESS",    label: "In Progress"       },
  { value: "OPEN_DONE",           label: "Done"              },
  { value: "CLOSED",              label: "Closed"            },
];

// Combined for the "All" tab (deduped)
const ALL_STATUS_OPTIONS: StatusOption[] = [
  { value: "",                    label: "All"               },
  ...BUG_STATUS_OPTIONS.slice(1),
  ...IMPL_STATUS_OPTIONS.slice(1).filter((opt) => !BUG_STATUS_OPTIONS.some((b) => b.value === opt.value)),
  { value: "REOPENED",            label: "Reopened"          },
];

const STATUS_OPTIONS = ALL_STATUS_OPTIONS; // legacy alias used by statusLabel()

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  UN_ASSIGNED:       { bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400"   },
  OPEN_NOT_STARTED:  { bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400"  },
  OPEN_IN_PROGRESS:  { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500"   },
  OPEN_QA:           { bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-500" },
  OPEN_DONE:         { bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-teal-500"   },
  WAITING_FOR_CLIENT:{ bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500" },
  CLOSED:            { bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
  SUBMITTED:         { bg: "bg-slate-50",   text: "text-slate-700",  dot: "bg-slate-400"  },
  ADMIN_REVIEW:      { bg: "bg-blue-50",    text: "text-blue-800",   dot: "bg-blue-600"   },
  PLANNING:          { bg: "bg-amber-50",   text: "text-amber-800",  dot: "bg-amber-500"  },
  CUSTOMER_APPROVAL: { bg: "bg-purple-50",  text: "text-purple-800", dot: "bg-purple-600" },
  APPROVED:          { bg: "bg-green-50",   text: "text-green-800",  dot: "bg-green-600"  },
  REOPENED:          { bg: "bg-orange-50",  text: "text-orange-800", dot: "bg-orange-600" },
};

function statusLabel(s: string): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {statusLabel(status)}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "just now";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ tickets }: { tickets: PortalTicket[] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full min-w-[600px] table-fixed text-sm">
        <colgroup>
          <col className="w-[10%]" />  {/* ID */}
          <col className="w-[38%]" />  {/* Subject */}
          <col className="w-[16%]" />  {/* Status */}
          <col className="w-[18%]" />  {/* Created */}
          <col className="w-[18%]" />  {/* Last Updated */}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="group hover:bg-accent/5 transition-colors">
              <td className="px-4 py-3.5 whitespace-nowrap">
                <Link
                  to={`/portal/tickets/${ticket.ticketId}`}
                  className="font-mono text-xs font-bold text-yellow-600 hover:text-yellow-700"
                >
                  {ticket.ticketId}
                </Link>
              </td>
              <td className="px-4 py-3.5">
                <Link
                  to={`/portal/tickets/${ticket.ticketId}`}
                  className="text-foreground font-medium hover:text-yellow-700 transition-colors line-clamp-1 group-hover:underline"
                >
                  {ticket.title}
                </Link>
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                {formatDate(ticket.createdAt)}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                <span title={formatDate(ticket.updatedAt)}>{formatDate(ticket.updatedAt)}</span>
                <span className="block text-muted-foreground mt-0.5">{timeAgo(ticket.updatedAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Grid View ────────────────────────────────────────────────────────────────

function GridView({ tickets }: { tickets: PortalTicket[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tickets.map((ticket) => (
        <Link
          key={ticket.id}
          to={`/portal/tickets/${ticket.ticketId}`}
          className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-accent/50 hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className="font-mono text-xs font-bold text-yellow-600">
              {ticket.ticketId}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-sm font-semibold text-foreground line-clamp-2 mb-4 group-hover:text-yellow-700 transition-colors">
            {ticket.title}
          </p>
          <div className="flex items-center justify-between">
            <StatusBadge status={ticket.status} />
            <span className="text-xs text-muted-foreground">{timeAgo(ticket.updatedAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full min-w-[600px] table-fixed text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {["ID", "Subject", "Status", "Created", "Last Updated"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              {[70, 220, 90, 70, 90, 70].map((w, j) => (
                <td key={j} className="px-4 py-3.5">
                  <Skeleton height={14} width={w} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Submit Ticket Modal ──────────────────────────────────────────────────────

const submitSchema = z.object({
  name:      z.string().min(1, "Name is required"),
  email:     z.string().email("Valid email required"),
  subject:   z.string().min(1, "Subject is required"),
  // New-requirement-only fields (validated only when requestType = "implementation")
  businessGoal:    z.string().optional(),
  currentPain:     z.string().optional(),
  expectedOutcome: z.string().optional(),
  targetDate:      z.string().optional(),
});
type SubmitInput = z.infer<typeof submitSchema>;
type RequestType = "support" | "implementation";

function SubmitTicketModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  // Derive slug from the current URL path as the authoritative source;
  // fall back to localStorage for clients that navigate directly to /portal/tickets
  const urlSlug  = window.location.pathname.match(/\/portal\/([^/]+)\//)?.[1] ?? "";
  const slug     = urlSlug || localStorage.getItem("portal-slug") || "";
  const [submitted, setSubmitted]             = useState<string | null>(null);
  const [descriptions, setDescriptions]       = useState<string[]>([""]);
  const [descErrors,   setDescErrors]         = useState<string[]>([""]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[][]>([[]]);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken]       = useState<string | undefined>();
  const [captchaAnswer, setCaptchaAnswer]     = useState<string>("");
  const [captchaReset, setCaptchaReset]       = useState(0);
  const [requestType, setRequestType]         = useState<RequestType>("support");
  const { data: session } = useSession();
  const sessionUser = session?.user as unknown as { name?: string; email?: string } | undefined;

  const { register, handleSubmit, setError, formState: { errors } } = useForm<SubmitInput>({
    resolver: zodResolver(submitSchema),
    defaultValues: { name: sessionUser?.name ?? "", email: sessionUser?.email ?? "" },
  });

  function addDescription() {
    setDescriptions((d) => [...d, ""]);
    setDescErrors((e) => [...e, ""]);
    setAttachmentFiles((f) => [...f, []]);
  }

  function removeDescription(idx: number) {
    setDescriptions((d) => d.filter((_, i) => i !== idx));
    setDescErrors((e) => e.filter((_, i) => i !== idx));
    setAttachmentFiles((f) => f.filter((_, i) => i !== idx));
  }

  function updateDescription(idx: number, value: string) {
    setDescriptions((d) => d.map((v, i) => (i === idx ? value : v)));
    setDescErrors((e) => e.map((v, i) => (i === idx ? "" : v)));
  }

  function updateAttachments(idx: number, files: File[]) {
    setAttachmentFiles((f) => f.map((v, i) => (i === idx ? files : v)));
  }

  const mutation = useMutation({
    mutationFn: (data: SubmitInput) => {
      const fd = new FormData();
      fd.append("name",         data.name);
      fd.append("email",        data.email);
      fd.append("subject",      data.subject);
      fd.append("body",         descriptions.join("\n\n---\n\n"));
      fd.append("captchaToken",  captchaToken  ?? "");
      fd.append("captchaAnswer", captchaAnswer ?? "");
      fd.append("requestType",   requestType);
      if (requestType === "implementation") {
        fd.append("businessGoal",    data.businessGoal    ?? "");
        fd.append("currentPain",     data.currentPain     ?? "");
        fd.append("expectedOutcome", data.expectedOutcome ?? "");
        if (data.targetDate) {
          fd.append("targetDate", new Date(data.targetDate).toISOString());
        }
      }
      attachmentFiles.forEach((files, i) => {
        for (const file of files) {
          fd.append("attachments", new File([file], `d${i}_${file.name}`, { type: file.type }));
        }
      });
      return axios.post(`/api/portal/${slug}/tickets`, fd);
    },
    onSuccess: (res) => {
      setSubmitted(res.data.ticketId);
      setDescriptions([""]);
      setDescErrors([""]);
      setAttachmentFiles([[]]);
      setCaptchaVerified(false);
      setCaptchaToken(undefined);
      setCaptchaAnswer("");
      setCaptchaReset((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["portal-tickets"] });
    },
  });

  const onSubmit = (data: SubmitInput) => {
    const errs = descriptions.map((d) =>
      d.trim().length < 10 ? "Please describe your issue (min 10 characters)" : ""
    );
    setDescErrors(errs);
    if (errs.some(Boolean)) return;

    if (requestType === "implementation") {
      const required: Array<[keyof SubmitInput, string]> = [
        ["businessGoal",    "Business goal"],
        ["currentPain",     "Current pain point"],
        ["expectedOutcome", "Expected outcome"],
      ];
      let hasError = false;
      for (const [key, label] of required) {
        const v = (data[key] ?? "").toString().trim();
        if (v.length < 10) {
          setError(key, { type: "manual", message: `${label} must be at least 10 characters` });
          hasError = true;
        }
      }
      if (hasError) return;
    }

    mutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Ticket Submitted!</h2>
            <p className="text-muted-foreground mb-1">
              Ticket <span className="font-mono font-semibold text-yellow-600">{submitted}</span> has been created.
            </p>
            <p className="text-sm text-gray-400 mb-6">Our team will get back to you shortly.</p>
            <button
              type="button"
              onClick={onClose}
              className="bg-yellow-600 text-white px-6 py-2.5 rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              Back to My Tickets
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-5">Submit a Request</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Request type — choose Bug/Support OR New Requirement */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">What are you submitting?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRequestType("support")}
                    className={`text-left p-3 rounded-lg border-2 transition-colors ${
                      requestType === "support"
                        ? "border-yellow-600 bg-yellow-50/50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm">Bug / Support</div>
                    <div className="text-xs text-gray-500 mt-1">Something is broken or not working as expected.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestType("implementation")}
                    className={`text-left p-3 rounded-lg border-2 transition-colors ${
                      requestType === "implementation"
                        ? "border-indigo-600 bg-indigo-50/50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm text-indigo-700">New Requirement</div>
                    <div className="text-xs text-gray-500 mt-1">Request a new feature. We'll plan it and send it back for your approval.</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
                <input
                  {...register("name")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="John Smith"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  readOnly
                  className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                <input
                  {...register("subject")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder={requestType === "implementation" ? "What feature do you want?" : "Brief summary of the issue"}
                />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
              </div>

              {/* New-Requirement-only fields */}
              {requestType === "implementation" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Business goal</label>
                    <textarea
                      {...register("businessGoal")}
                      rows={3}
                      placeholder="What outcome are you trying to achieve?"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.businessGoal ? "border-red-400" : "border-gray-200"}`}
                    />
                    {errors.businessGoal && <p className="text-red-500 text-xs mt-1">{errors.businessGoal.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Current pain point</label>
                    <textarea
                      {...register("currentPain")}
                      rows={3}
                      placeholder="What's not working today?"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.currentPain ? "border-red-400" : "border-gray-200"}`}
                    />
                    {errors.currentPain && <p className="text-red-500 text-xs mt-1">{errors.currentPain.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Expected outcome</label>
                    <textarea
                      {...register("expectedOutcome")}
                      rows={3}
                      placeholder="How will you know this is solved?"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${errors.expectedOutcome ? "border-red-400" : "border-gray-200"}`}
                    />
                    {errors.expectedOutcome && <p className="text-red-500 text-xs mt-1">{errors.expectedOutcome.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Target date <span className="text-gray-400">(optional)</span></label>
                    <input
                      {...register("targetDate")}
                      type="date"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {/* Descriptions — one or more, each with its own image uploader */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                {descriptions.map((desc, idx) => (
                  <div key={idx} className="space-y-1.5">
                    {descriptions.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                          Description {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDescription(idx)}
                          className="flex items-center gap-0.5 text-xs text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    )}
                    <textarea
                      rows={4}
                      value={desc}
                      onChange={(e) => updateDescription(idx, e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none ${
                        descErrors[idx] ? "border-red-400" : "border-gray-200"
                      }`}
                      placeholder={idx === 0 ? "Describe your issue in detail..." : "Additional description…"}
                    />
                    {descErrors[idx] && (
                      <p className="text-red-500 text-xs">{descErrors[idx]}</p>
                    )}
                    <ImageUploadField
                      files={attachmentFiles[idx] ?? []}
                      onChange={(files) => updateAttachments(idx, files)}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDescription}
                  className="flex items-center gap-1.5 text-sm font-medium text-yellow-600 hover:text-yellow-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Description
                </button>
              </div>

              <SimpleCaptcha
                onVerify={(verified, token, answer) => {
                  setCaptchaVerified(verified);
                  setCaptchaToken(token);
                  setCaptchaAnswer(answer ?? "");
                }}
                reset={captchaReset}
              />

              {mutation.isError && (
                <p className="text-red-500 text-sm">Failed to submit. Please try again.</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={mutation.isPending || !captchaVerified}
                  className="flex-1 bg-yellow-600 text-white py-2.5 rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors font-medium text-sm"
                >
                  {mutation.isPending ? "Submitting…" : "Submit Ticket"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function PortalTickets() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tabFilter,      setTabFilter]      = useState<TabFilter>("all");
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>("");
  const [search,         setSearch]         = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [sortOrder,      setSortOrder]      = useState<SortOrder>("desc");
  const [viewMode,       setViewMode]       = useState<ViewMode>("list");
  const [page,           setPage]           = useState(1);
  const [showForm,       setShowForm]       = useState(() => searchParams.get("new") === "1");

  // Effective type filter sent to the server. Tabs always win when not "all".
  const effectiveTypeFilter: readonly TicketTypeValue[] | null =
    tabFilter === "bug"      ? BUG_TYPES :
    tabFilter === "impl"     ? IMPL_TYPES :
    tabFilter === "reopened" ? null :
    null;

  // When the reopened tab is active, force status filter to REOPENED.
  const effectiveStatusFilter: StatusFilter =
    tabFilter === "reopened" ? "REOPENED" : statusFilter;

  // Clean up ?new=1 from URL after reading it on mount
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      navigate("/portal/tickets", { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, isError } = useQuery<TicketsResponse>({
    queryKey: ["portal-tickets", tabFilter, statusFilter, search, dateFrom, dateTo, sortOrder, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        sortOrder,
        page:     String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (effectiveStatusFilter) params.set("status", effectiveStatusFilter);
      if (search.trim())  params.set("search",   search.trim());
      if (dateFrom)       params.set("from",     dateFrom);
      if (dateTo)         params.set("to",       dateTo);
      // Repeated `type` params produce ?type=A&type=B — server-side support is
      // optional today; client-side fallback below handles older deployments.
      if (effectiveTypeFilter) {
        for (const t of effectiveTypeFilter) params.append("type", t);
      }
      const res = await axios.get<TicketsResponse>(`/api/portal/tickets?${params}`, {
        withCredentials: true,
      });
      return res.data;
    },
  });

  const rawTickets = data?.data ?? [];
  // Client-side fallback in case the portal endpoint hasn't picked up the
  // new array filter yet. When the response carries a `type` field we trust
  // it; otherwise we surface every ticket (preserves old behaviour).
  const tickets =
    effectiveTypeFilter && rawTickets.some((t) => t.type !== undefined)
      ? rawTickets.filter((t) => !t.type || effectiveTypeFilter.includes(t.type))
      : rawTickets;
  const totalPages = data?.totalPages ?? 1;

  const hasFilters = statusFilter || search || dateFrom || dateTo;

  function clearFilters() {
    setStatusFilter("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {showForm && <SubmitTicketModal onClose={() => setShowForm(false)} />}

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Tickets</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? "Loading…" : `${data?.total ?? 0} ticket${(data?.total ?? 0) !== 1 ? "s" : ""} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="bg-yellow-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-yellow-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          Submit a Ticket
        </button>
      </div>

      {/* ── Type tabs ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label="Ticket type tabs">
        {([
          { value: "all",      label: "All"              },
          { value: "bug",      label: "Bugs & Support"   },
          { value: "impl",     label: "New Requirements" },
          { value: "reopened", label: "Reopened"         },
        ] as { value: TabFilter; label: string }[]).map((t) => {
          const active = tabFilter === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => { setTabFilter(t.value); setStatusFilter(""); setPage(1); }}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                active
                  ? "bg-yellow-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5 space-y-3">
        {/* Row 1: Search + sort + view toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0 w-full sm:min-w-48 sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search tickets…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          {/* Date range wrapper */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date from */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            {/* Date to */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          {/* Sort */}
          <button
            type="button"
            onClick={() => { setSortOrder((s) => (s === "desc" ? "asc" : "desc")); setPage(1); }}
            className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            {sortOrder === "desc" ? "Newest first" : "Oldest first"}
          </button>

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden ml-auto">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="List view"
              className={`px-3 py-2 transition-colors ${viewMode === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`px-3 py-2 transition-colors ${viewMode === "grid" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />

          {/* Status pill buttons — filtered by active tab so customers don't see
              implementation-only statuses on the Bug tab and vice versa. */}
          <div className="flex flex-wrap gap-1.5">
            {(tabFilter === "bug"  ? BUG_STATUS_OPTIONS  :
              tabFilter === "impl" ? IMPL_STATUS_OPTIONS :
              ALL_STATUS_OPTIONS).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  statusFilter === opt.value
                    ? "bg-yellow-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading && <SkeletonRows />}

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl text-center">
          Failed to load tickets. Please refresh the page.
        </div>
      )}

      {!isLoading && !isError && tickets.length === 0 && (
        <div className="bg-card border border-border rounded-xl flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">
            {hasFilters ? "No tickets match your filters." : "No tickets yet."}
          </p>
          {hasFilters ? (
            <button type="button" onClick={clearFilters} className="text-sm text-yellow-600 hover:underline">
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="bg-yellow-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-yellow-700 transition-colors mt-1"
            >
              + Submit a Ticket
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && tickets.length > 0 && (
        <>
          {viewMode === "list" ? <ListView tickets={tickets} /> : <GridView tickets={tickets} />}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground">
                {data?.total} tickets · page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
