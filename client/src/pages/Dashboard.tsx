import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Ticket,
  CircleDot,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Star,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentWorkload {
  id:           string;
  name:         string;
  openTickets:  number;
  closedToday:  number;
  totalTickets: number;
}

interface ClientRecentTicket {
  ticketId:   string;
  title:      string;
  status:     string;
  updatedAt:  string;
  clientId:   string;
  clientName: string;
}



interface StatusBreakdown { status: string; count: number; }
interface PriorityBreakdown { priority: string; count: number; }

interface ClientBreakdown {
  clientId:        string;
  clientName:      string;
  total:           number;
  newRequirements: number;
}

interface DashboardStats {
  total:              number;
  open:               number;
  unAssigned:         number;
  aiResolved:         number;
  aiResolvedPercent:  number;
  avgResolutionTimeMs: number;
  createdToday:       number;
  closedToday:        number;
  avgRating:          number | null;
  ratedCount:         number;
  dailyCounts:        Array<{ date: string; count: number }>;
  agentWorkload:      AgentWorkload[];
  clientRecentTickets: ClientRecentTicket[];
  statusBreakdown:    StatusBreakdown[];
  priorityBreakdown:  PriorityBreakdown[];
  newRequirementsTotal: number;
  clientBreakdown:    ClientBreakdown[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  UN_ASSIGNED:      "Un-Assigned",
  OPEN_NOT_STARTED: "Not Started",
  OPEN_IN_PROGRESS: "In Progress",
  OPEN_QA:          "QA",
  OPEN_DONE:        "Done",
  CLOSED:           "Closed",
};

const STATUS_DOT: Record<string, string> = {
  UN_ASSIGNED:      "bg-gray-400",
  OPEN_NOT_STARTED: "bg-amber-400",
  OPEN_IN_PROGRESS: "bg-blue-500",
  OPEN_QA:          "bg-violet-500",
  OPEN_DONE:        "bg-teal-500",
  CLOSED:           "bg-green-500",
};

const STATUS_COLORS: Record<string, string> = {
  UN_ASSIGNED:      "#94a3b8",
  OPEN_NOT_STARTED: "#f59e0b",
  OPEN_IN_PROGRESS: "#3b82f6",
  OPEN_QA:          "#8b5cf6",
  OPEN_DONE:        "#14b8a6",
  CLOSED:           "#22c55e",
};

const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const PRIORITY_LABELS_MAP: Record<string, string> = {
  LOW:      "Low",
  MEDIUM:   "Medium",
  HIGH:     "High",
  CRITICAL: "Critical",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW:      "#94a3b8",
  MEDIUM:   "#f59e0b",
  HIGH:     "#f97316",
  CRITICAL: "#ef4444",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  const minutes = Math.floor(ms / 60000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (days > 0)    return `${days}d ${hours % 24}h`;
  if (hours > 0)   return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.floor(ms / 1000)}s`;
}

function formatChartDate(iso: string): string {
  const [, month, day] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)    return `${days}d ago`;
  if (hours > 0)   return `${hours}h ago`;
  if (mins > 0)    return `${mins}m ago`;
  return "just now";
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:    string;
  value:    string | number;
  sub?:     string;
  icon:     React.ReactNode;
  accent?:  "blue" | "amber" | "green" | "teal" | "violet" | "orange";
}

const ACCENT_BG: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-600",
  amber:  "bg-amber-50 text-amber-600",
  green:  "bg-green-50 text-green-600",
  teal:   "bg-teal-50 text-teal-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-600",
};

function KpiCard({ label, value, sub, icon, accent = "blue" }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`flex-shrink-0 ml-3 p-2.5 rounded-lg ${ACCENT_BG[accent]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Star Rating Display ──────────────────────────────────────────────────────

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`${sz} ${i < Math.round(rating) ? "text-amber-400" : "text-muted-foreground/30"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/** Build "All time" + last 12 calendar months as YYYY-MM picker options. */
function buildMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [{ value: "", label: "All time" }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    opts.push({ value, label });
  }
  return opts;
}

function Dashboard() {
  const [month, setMonth] = useState<string>("");
  const monthOptions = buildMonthOptions();

  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", month],
    queryFn: async () => {
      const url = month ? `/api/tickets/stats?month=${month}` : "/api/tickets/stats";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--rt-text-1)" }}>
            Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--rt-text-3)" }}>
            Support queue overview — today's snapshot and trends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="month-filter" className="text-xs font-medium" style={{ color: "var(--rt-text-3)" }}>
            Month:
          </label>
          <select
            id="month-filter"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-8 text-xs rounded-md px-2 border bg-background"
            style={{ borderColor: "var(--rt-border)" }}
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isError && (
        <p className="text-destructive mb-4 text-sm">Failed to load dashboard stats.</p>
      )}

      {/* ── KPI Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          <KpiCard
            label="Total Tickets"
            value={stats.total}
            sub="all time"
            icon={<Ticket className="h-5 w-5" />}
            accent="blue"
          />
          <KpiCard
            label="Open"
            value={stats.open}
            sub="being worked"
            icon={<CircleDot className="h-5 w-5" />}
            accent="violet"
          />
          <KpiCard
            label="Un-Assigned"
            value={stats.unAssigned}
            sub="needs attention"
            icon={<AlertTriangle className="h-5 w-5" />}
            accent="amber"
          />
          <KpiCard
            label="New Requirements"
            value={stats.newRequirementsTotal}
            sub="implementation tickets"
            icon={<CircleDot className="h-5 w-5" />}
            accent="violet"
          />
          <KpiCard
            label="Created Today"
            value={stats.createdToday}
            sub="new tickets"
            icon={<Plus className="h-5 w-5" />}
            accent="orange"
          />
          <KpiCard
            label="Closed Today"
            value={stats.closedToday}
            sub="resolved today"
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent="green"
          />
          <KpiCard
            label="Avg Rating"
            value={stats.avgRating != null ? `${stats.avgRating}/5` : "—"}
            sub={stats.ratedCount > 0 ? `${stats.ratedCount} rated` : "no ratings yet"}
            icon={<Star className="h-5 w-5" />}
            accent="teal"
          />
        </div>
      ) : null}

      {/* ── 30-day Volume Chart ── */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Ticket Volume — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart
                data={stats?.dailyCounts ?? []}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--rt-border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => [Number(value), "Tickets"]}
                  labelFormatter={(label) => formatChartDate(String(label))}
                  cursor={{ fill: "var(--rt-surface-2)" }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Per-client breakdown: total tickets vs new requirements ── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Tickets by Client</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !stats?.clientBreakdown?.length ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">No client tickets yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Client</th>
                  <th className="text-right px-4 py-2 font-medium">Total tickets</th>
                  <th className="text-right px-4 py-2 font-medium">New requirements</th>
                  <th className="text-right px-4 py-2 font-medium">Bugs &amp; support</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.clientBreakdown.map((c) => (
                  <tr key={c.clientId} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{c.clientName}</td>
                    <td className="px-4 py-2.5 text-right">{c.total}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-indigo-700 font-medium">{c.newRequirements}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{c.total - c.newRequirements}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Agent Workload + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Recent Tickets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Client Tickets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !stats?.clientRecentTickets?.length ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">No client tickets available.</p>
            ) : (
              <ul className="divide-y divide-border">
                {stats.clientRecentTickets.map((item) => (
                  <li key={item.ticketId} className="flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors">
                    <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[item.status] ?? "bg-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{item.ticketId}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-0.5 truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium" style={{ color: "var(--rt-accent)" }}>
                        {item.clientName}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(item.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution + Priority Breakdown */}
        <div className="flex flex-col gap-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats?.statusBreakdown ?? []}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {(stats?.statusBreakdown ?? []).map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [v, STATUS_LABELS[String(name)] ?? name]} />
                    <Legend formatter={(value) => STATUS_LABELS[value] ?? value} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Priority Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Priority Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={PRIORITY_ORDER.map((p) => ({
                      priority: p,
                      count: stats?.priorityBreakdown?.find((r) => r.priority === p)?.count ?? 0,
                    }))}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--rt-border)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--rt-text-3)" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="priority" tickFormatter={(v) => PRIORITY_LABELS_MAP[v] ?? v} tick={{ fontSize: 11, fill: "var(--rt-text-3)" }} tickLine={false} axisLine={false} width={64} />
                    <Tooltip formatter={(v) => [v, "Tickets"]} labelFormatter={(l) => PRIORITY_LABELS_MAP[l] ?? l} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {PRIORITY_ORDER.map((p) => (
                        <Cell key={p} fill={PRIORITY_COLORS[p]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Secondary Stats Row ── */}
      {!isLoading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">AI Resolution Rate</p>
              <p className="text-3xl font-bold text-teal-600">{stats.aiResolvedPercent}%</p>
              <p className="text-xs text-muted-foreground mt-1">{stats.aiResolved} tickets auto-resolved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Avg Resolution Time</p>
              <p className="text-3xl font-bold text-orange-600">{formatDuration(stats.avgResolutionTimeMs)}</p>
              <p className="text-xs text-muted-foreground mt-1">based on done tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Customer Satisfaction</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-3xl font-bold text-amber-500">
                  {stats.avgRating != null ? stats.avgRating : "—"}
                </p>
                {stats.avgRating != null && (
                  <div className="pb-0.5">
                    <StarRating rating={stats.avgRating} size="lg" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.ratedCount > 0 ? `${stats.ratedCount} customer ratings` : "no ratings yet"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
