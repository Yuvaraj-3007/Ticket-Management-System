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
  id:          string;
  name:        string;
  openTickets: number;
  closedToday: number;
}

interface RecentActivity {
  ticketId:   string;
  title:      string;
  status:     string;
  updatedAt:  string;
  assignedTo: string | null;
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
  recentActivity:     RecentActivity[];
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
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
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
          className={`${sz} ${i < Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
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

function Dashboard() {
  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/tickets/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--rt-text-1)" }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--rt-text-3)" }}>
          Support queue overview — today's snapshot and trends
        </p>
      </div>

      {isError && (
        <p className="text-destructive mb-4 text-sm">Failed to load dashboard stats.</p>
      )}

      {/* ── KPI Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => [Number(value), "Tickets"]}
                  labelFormatter={(label) => formatChartDate(String(label))}
                  cursor={{ fill: "#f3f4f6" }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Agent Workload + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Workload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Agent Workload</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : !stats?.agentWorkload.length ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">No agent data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Agent</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Open</th>
                      <th className="text-right py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Closed Today</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.agentWorkload.map((agent) => (
                      <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-900">{agent.name}</td>
                        <td className="py-3 px-4 text-right">
                          {agent.openTickets > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              {agent.openTickets}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {agent.closedToday > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              {agent.closedToday}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !stats?.recentActivity.length ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {stats.recentActivity.map((item) => (
                  <li key={item.ticketId} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <span
                      className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[item.status] ?? "bg-gray-400"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{item.ticketId}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mt-0.5 truncate">{item.title}</p>
                      {item.assignedTo && (
                        <p className="text-xs text-muted-foreground mt-0.5">→ {item.assignedTo}</p>
                      )}
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
