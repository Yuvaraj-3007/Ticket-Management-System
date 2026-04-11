import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusBreakdown {
  unAssigned: number;
  notStarted: number;
  inProgress: number;
  qa:         number;
  done:       number;
  closed:     number;
}

interface OpenTicket {
  id:        string;
  ticketId:  string;
  title:     string;
  status:    string;
  priority:  string;
  updatedAt: string;
  createdAt: string;
}

interface DashboardData {
  total:           number;
  open:            number;
  unAssigned:      number;
  closed:          number;
  statusBreakdown: StatusBreakdown;
  openTickets:     OpenTicket[];
  daily:           Array<{ day: number; count: number }>;
  recent:          Array<{ id: string; ticketId: string; title: string; status: string; createdAt: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  UN_ASSIGNED:      "Awaiting Support",
  OPEN_NOT_STARTED: "Not Started",
  OPEN_IN_PROGRESS: "In Progress",
  OPEN_QA:          "QA",
  OPEN_DONE:        "Done",
  CLOSED:           "Closed",
};

const STATUS_BADGE: Record<string, string> = {
  UN_ASSIGNED:      "bg-muted text-muted-foreground",
  OPEN_NOT_STARTED: "bg-amber-100 text-amber-700",
  OPEN_IN_PROGRESS: "bg-blue-100 text-blue-700",
  OPEN_QA:          "bg-purple-100 text-purple-700",
  OPEN_DONE:        "bg-teal-100 text-teal-700",
  CLOSED:           "bg-green-100 text-green-700",
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW:      "bg-muted text-muted-foreground",
  MEDIUM:   "bg-yellow-100 text-yellow-700",
  HIGH:     "bg-yellow-100 text-yellow-700",
  CRITICAL: "bg-red-100 text-red-700",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "just now";
}

function SummaryCard({ label, value, accent, loading }: {
  label: string; value: number; accent?: boolean; loading: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "bg-yellow-600 text-white border-yellow-600" : "bg-card border-border"}`}>
      <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${accent ? "text-yellow-100" : "text-muted-foreground"}`}>{label}</p>
      <p className={`text-3xl font-bold ${accent ? "text-white" : "text-foreground"}`}>{loading ? "—" : value}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">{title}</h2>;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded-lg ${className ?? ""}`} />;
}

// ─── Status bar row ───────────────────────────────────────────────────────────

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold text-foreground">{count}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PortalDashboard() {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["portal-dashboard", "v3"],
    queryFn:  async () => {
      const res = await axios.get("/api/portal/dashboard", { withCredentials: true });
      return res.data;
    },
    staleTime: 30_000,
  });

  const sb    = data?.statusBreakdown;
  const total = data?.total ?? 0;

  // Build daily bar chart — fill all days of current month
  const now        = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyMap   = Object.fromEntries((data?.daily ?? []).map((d) => [d.day, d.count]));
  const barData    = Array.from({ length: now.getDate() }, (_, i) => ({
    day:   i + 1,
    count: dailyMap[i + 1] ?? 0,
  }));
  const hasBarData = barData.some((d) => d.count > 0);

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-8 max-w-7xl mx-auto">

      {/* Page title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {now.toLocaleString("default", { month: "long", year: "numeric" })} overview of your support tickets
        </p>
      </div>

      {isError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/30 text-sm p-4 rounded-lg">
          Failed to load dashboard. Please refresh the page.
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Tickets"     value={total}              accent  loading={isLoading} />
        <SummaryCard label="Awaiting Support"  value={data?.unAssigned ?? 0}      loading={isLoading} />
        <SummaryCard label="In Progress"       value={data?.open       ?? 0}      loading={isLoading} />
        <SummaryCard label="Resolved"          value={data?.closed     ?? 0}      loading={isLoading} />
      </div>

      {/* ── Main content row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active tickets — 2/3 width */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="My Active Tickets" />
            <Link to="/portal/tickets" className="text-xs font-medium text-yellow-600 hover:text-yellow-700">
              View all →
            </Link>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          )}

          {!isLoading && (data?.openTickets ?? []).length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
              <p className="text-sm text-muted-foreground">No active tickets</p>
              <Link to="/portal/tickets" className="text-xs text-yellow-600 hover:underline">
                Submit a new ticket →
              </Link>
            </div>
          )}

          {!isLoading && (data?.openTickets ?? []).length > 0 && (
            <div className="divide-y divide-border">
              {(data?.openTickets ?? []).map((t) => (
                <Link
                  key={t.id}
                  to={`/portal/tickets/${t.ticketId}`}
                  className="flex items-center gap-3 py-3 hover:bg-muted -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-yellow-600">{t.ticketId}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[t.priority] ?? "bg-muted text-muted-foreground"}`}>
                        {t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate group-hover:underline">{t.title}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[t.status] ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(t.updatedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Status breakdown — 1/3 width */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <SectionHeader title="Status Breakdown" />
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : total === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">No tickets yet</div>
          ) : (
            <div className="space-y-4">
              <StatusBar label="Awaiting Support"  count={sb?.unAssigned ?? 0} total={total} color="#9CA3AF" />
              <StatusBar label="Not Started"        count={sb?.notStarted ?? 0} total={total} color="#F59E0B" />
              <StatusBar label="In Progress"        count={sb?.inProgress ?? 0} total={total} color="#3B82F6" />
              <StatusBar label="QA"                 count={sb?.qa         ?? 0} total={total} color="#8B5CF6" />
              <StatusBar label="Done"               count={sb?.done       ?? 0} total={total} color="#14B8A6" />
              <StatusBar label="Closed"             count={sb?.closed     ?? 0} total={total} color="#22C55E" />
            </div>
          )}
        </div>
      </div>

      {/* ── This month activity chart ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <SectionHeader title={`Tickets Submitted — ${now.toLocaleString("default", { month: "long", year: "numeric" })}`} />
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !hasBarData ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            No tickets submitted this month
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--rt-border)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "var(--rt-text-3)" }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(daysInMonth / 10)}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "var(--rt-text-3)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--rt-border)" }}
                formatter={(v) => [v ?? 0, "Tickets"]}
                labelFormatter={(l) => `Day ${l}`}
              />
              <Bar dataKey="count" fill="#ca8a04" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
