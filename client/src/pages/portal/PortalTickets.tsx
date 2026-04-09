import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { SimpleCaptcha } from "@/components/portal/SimpleCaptcha";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUploadField } from "@/components/portal/ImageUploadField";
import { Search, LayoutList, LayoutGrid, ArrowUpDown, SlidersHorizontal, X } from "lucide-react";

interface HrmsProject {
  id:          string;
  projectCode: string;
  projectName: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PortalTicket = {
  id:        string;
  ticketId:  string;
  title:     string;
  status:    string;
  priority:  string;
  createdAt: string;
  updatedAt: string;
  rating:    number | null;
};

interface TicketsResponse {
  data:       PortalTicket[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

type StatusFilter   = "" | "UN_ASSIGNED" | "OPEN_NOT_STARTED" | "OPEN_IN_PROGRESS" | "OPEN_QA" | "OPEN_DONE" | "CLOSED";
type PriorityFilter = "" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type SortOrder      = "desc" | "asc";
type ViewMode       = "list" | "grid";

// ─── Status / Priority config ─────────────────────────────────────────────────

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "",                label: "All"         },
  { value: "UN_ASSIGNED",     label: "Un-Assigned" },
  { value: "OPEN_NOT_STARTED",label: "Not Started" },
  { value: "OPEN_IN_PROGRESS",label: "In Progress" },
  { value: "OPEN_QA",         label: "QA"          },
  { value: "OPEN_DONE",       label: "Done"        },
  { value: "CLOSED",          label: "Closed"      },
];

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  UN_ASSIGNED:      { bg: "bg-gray-100",   text: "text-gray-600",  dot: "bg-gray-400"   },
  OPEN_NOT_STARTED: { bg: "bg-amber-50",   text: "text-amber-700", dot: "bg-amber-400"  },
  OPEN_IN_PROGRESS: { bg: "bg-blue-50",    text: "text-blue-700",  dot: "bg-blue-500"   },
  OPEN_QA:          { bg: "bg-purple-50",  text: "text-purple-700",dot: "bg-purple-500" },
  OPEN_DONE:        { bg: "bg-teal-50",    text: "text-teal-700",  dot: "bg-teal-500"   },
  CLOSED:           { bg: "bg-green-50",   text: "text-green-700", dot: "bg-green-500"  },
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
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[10%]" />  {/* ID */}
          <col className="w-[38%]" />  {/* Subject */}
          <col className="w-[16%]" />  {/* Status */}
          <col className="w-[18%]" />  {/* Created */}
          <col className="w-[18%]" />  {/* Last Updated */}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="group hover:bg-orange-50/30 transition-colors">
              <td className="px-4 py-3.5 whitespace-nowrap">
                <Link
                  to={`/portal/tickets/${ticket.ticketId}`}
                  className="font-mono text-xs font-bold text-orange-500 hover:text-orange-600"
                >
                  {ticket.ticketId}
                </Link>
              </td>
              <td className="px-4 py-3.5">
                <Link
                  to={`/portal/tickets/${ticket.ticketId}`}
                  className="text-gray-800 font-medium hover:text-orange-600 transition-colors line-clamp-1 group-hover:underline"
                >
                  {ticket.title}
                </Link>
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-400">
                {formatDate(ticket.createdAt)}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-400">
                <span title={formatDate(ticket.updatedAt)}>{formatDate(ticket.updatedAt)}</span>
                <span className="block text-gray-300 mt-0.5">{timeAgo(ticket.updatedAt)}</span>
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
          className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-200 hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className="font-mono text-xs font-bold text-orange-500">
              {ticket.ticketId}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-4 group-hover:text-orange-600 transition-colors">
            {ticket.title}
          </p>
          <div className="flex items-center justify-between">
            <StatusBadge status={ticket.status} />
            <span className="text-xs text-gray-400">{timeAgo(ticket.updatedAt)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            {["ID", "Subject", "Status", "Created", "Last Updated"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
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
  projectId: z.string().min(1, "Please select a project"),
  subject:   z.string().min(1, "Subject is required"),
  body:      z.string().min(10, "Please describe your issue (min 10 characters)"),
});
type SubmitInput = z.infer<typeof submitSchema>;

function SubmitTicketModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const slug     = localStorage.getItem("portal-slug")      ?? "";
  const clientId = localStorage.getItem("portal-client-id") ?? "";
  const [submitted, setSubmitted]           = useState<string | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken]       = useState<string | undefined>();
  const [captchaAnswer, setCaptchaAnswer]     = useState<string>("");
  const [captchaReset, setCaptchaReset]       = useState(0);
  const { data: session } = useSession();
  const sessionUser = session?.user as unknown as { name?: string; email?: string } | undefined;

  const { data: projects = [], isLoading: projectsLoading } = useQuery<HrmsProject[]>({
    queryKey: ["portal-projects", clientId || slug],
    queryFn: async () => {
      if (clientId) {
        const res = await axios.get<HrmsProject[]>(`/api/portal/projects?clientId=${clientId}`);
        return res.data;
      }
      const res = await axios.get<HrmsProject[]>(`/api/portal/${slug}/projects`);
      return res.data;
    },
    enabled: Boolean(clientId || slug),
    staleTime: 5 * 60 * 1000,
  });

  const { register, handleSubmit, control, formState: { errors } } = useForm<SubmitInput>({
    resolver: zodResolver(submitSchema),
    defaultValues: { name: sessionUser?.name ?? "", email: sessionUser?.email ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (data: SubmitInput) => {
      const selectedProject = projects.find((p) => p.id === data.projectId);
      const fd = new FormData();
      fd.append("name",        data.name);
      fd.append("email",       data.email);
      fd.append("subject",     data.subject);
      fd.append("body",        data.body);
      fd.append("projectId",   data.projectId);
      fd.append("projectName",  selectedProject?.projectName ?? "");
      fd.append("captchaToken",  captchaToken  ?? "");
      fd.append("captchaAnswer", captchaAnswer ?? "");
      for (const file of attachmentFiles) fd.append("attachments", file);
      return axios.post(`/api/portal/${slug}/tickets`, fd);
    },
    onSuccess: (res) => {
      setSubmitted(res.data.ticketId);
      setAttachmentFiles([]);
      setCaptchaVerified(false);
      setCaptchaToken(undefined);
      setCaptchaAnswer("");
      setCaptchaReset((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["portal-tickets"] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ticket Submitted!</h2>
            <p className="text-gray-600 mb-1">
              Ticket <span className="font-mono font-semibold text-orange-500">{submitted}</span> has been created.
            </p>
            <p className="text-sm text-gray-400 mb-6">Our team will get back to you shortly.</p>
            <button
              type="button"
              onClick={onClose}
              className="bg-orange-500 text-white px-6 py-2.5 rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              Back to My Tickets
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-5">Submit a Support Request</h2>
            <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
                <input
                  {...register("name")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
                <Controller
                  name="projectId"
                  control={control}
                  render={({ field }) => (
                    <select
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      disabled={projectsLoading}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white ${
                        errors.projectId ? "border-red-400" : "border-gray-200"
                      } ${projectsLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <option value="">{projectsLoading ? "Loading projects…" : "Select a project"}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.projectName}</option>
                      ))}
                    </select>
                  )}
                />
                {errors.projectId && <p className="text-red-500 text-xs mt-1">{errors.projectId.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                <input
                  {...register("subject")}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  placeholder="Brief summary of the issue"
                />
                {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  {...register("body")}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
                  placeholder="Describe your issue in detail..."
                />
                {errors.body && <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>}
              </div>

              <ImageUploadField files={attachmentFiles} onChange={setAttachmentFiles} />
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
                  className="flex-1 bg-orange-500 text-white py-2.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium text-sm"
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
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("");
  const [search,         setSearch]         = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [sortOrder,      setSortOrder]      = useState<SortOrder>("desc");
  const [viewMode,       setViewMode]       = useState<ViewMode>("list");
  const [page,           setPage]           = useState(1);
  const [showForm,       setShowForm]       = useState(false);

  const { data, isLoading, isError } = useQuery<TicketsResponse>({
    queryKey: ["portal-tickets", statusFilter, priorityFilter, search, dateFrom, dateTo, sortOrder, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        sortOrder,
        page:     String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter)   params.set("status",   statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (search.trim())  params.set("search",   search.trim());
      if (dateFrom)       params.set("from",     dateFrom);
      if (dateTo)         params.set("to",       dateTo);
      const res = await axios.get<TicketsResponse>(`/api/portal/tickets?${params}`, {
        withCredentials: true,
      });
      return res.data;
    },
  });

  const tickets    = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const hasFilters = statusFilter || priorityFilter || search || dateFrom || dateTo;

  function clearFilters() {
    setStatusFilter("");
    setPriorityFilter("");
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
          className="bg-orange-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-2 shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          Submit a Ticket
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-3">
        {/* Row 1: Search + sort + view toggle */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search tickets…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          {/* Date from */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Date to */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
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

        {/* Row 2: Status pills + Priority dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />

          {/* Status pill buttons */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  statusFilter === opt.value
                    ? "bg-orange-500 text-white"
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
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">
            {hasFilters ? "No tickets match your filters." : "No tickets yet."}
          </p>
          {hasFilters ? (
            <button type="button" onClick={clearFilters} className="text-sm text-orange-500 hover:underline">
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="bg-orange-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-orange-600 transition-colors mt-1"
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
              <p className="text-sm text-gray-400">
                Page {page} of {totalPages} · {data?.total} tickets
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-sm border border-gray-200 rounded-lg px-3.5 py-2 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-sm border border-gray-200 rounded-lg px-3.5 py-2 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
