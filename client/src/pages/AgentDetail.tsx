import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { ROLES } from "@tms/core";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type AgentSummary = {
  totalAssigned: number;
  totalClosed: number;
  avgResolutionMs: number | null;
  avgRating: number | null;
  ratedCount: number;
};

type RecentTicket = {
  ticketId: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  project: string | null;
  createdAt: string;
  updatedAt: string;
  resolutionDays: number | null;
  rating: number | null;
};

type AgentStatsData = {
  user: AgentUser;
  summary: AgentSummary;
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  byProject: Array<{ project: string; count: number }>;
  monthlyTrend: Array<{ month: string; opened: number; closed: number }>;
  recentTickets: RecentTicket[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  UN_ASSIGNED:      "Un-Assigned",
  OPEN_NOT_STARTED: "Not Started",
  OPEN_IN_PROGRESS: "In Progress",
  OPEN_QA:          "QA",
  OPEN_DONE:        "Done",
  CLOSED:           "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  UN_ASSIGNED:      "#6B7280",
  OPEN_NOT_STARTED: "#F59E0B",
  OPEN_IN_PROGRESS: "#3B82F6",
  OPEN_QA:          "#8B5CF6",
  OPEN_DONE:        "#14B8A6",
  CLOSED:           "#22C55E",
};

const TYPE_COLORS: Record<string, string> = {
  BUG:         "#EF4444",
  TASK:        "#3B82F6",
  SUPPORT:     "#8B5CF6",
  REQUIREMENT: "#F59E0B",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatResolution(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

function formatRating(rating: number | null, ratedCount: number): string {
  if (rating == null) return "—";
  return `★ ${rating.toFixed(1)} (${ratedCount} rated)`;
}

function exportCSV(tickets: RecentTicket[], agentName: string) {
  const rows = [
    ["Ticket ID", "Title", "Status", "Priority", "Project", "Resolution Days", "Rating"],
    ...tickets.map((t) => [
      t.ticketId,
      t.title,
      t.status,
      t.priority,
      t.project ?? "",
      t.resolutionDays ?? "",
      t.rating ?? "",
    ]),
  ];
  const csv = rows.map((r) => r.map(String).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${agentName.replace(/\s+/g, "-")}-report.csv`;
  a.click();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AgentDetailSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--rt-text-2)" }}>
          {label}
        </p>
        <p className="text-3xl font-bold" style={{ color: "var(--rt-text-1)" }}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery<AgentStatsData>({
    queryKey: ["agent-stats", id],
    queryFn: async () => {
      const res = await axios.get<AgentStatsData>(`${API_URL}/api/users/${id}/stats`, {
        withCredentials: true,
      });
      return res.data;
    },
    staleTime: 60_000,
    enabled: Boolean(id),
  });

  if (isLoading) return <AgentDetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md">
          Failed to load agent data. Please refresh the page.
        </div>
      </div>
    );
  }

  const { user, summary, byStatus, byProject, byType, monthlyTrend, recentTickets } = data;

  // ── Chart data ──────────────────────────────────────────────────────────────

  const statusChartData = byStatus.map((s) => ({
    status: STATUS_LABELS[s.status] ?? s.status,
    count:  s.count,
    fill:   STATUS_COLORS[s.status] ?? "#6B7280",
    rawStatus: s.status,
  }));

  const projectChartData = byProject.map((p) => ({
    project: p.project,
    count:   p.count,
  }));

  const typeChartData = byType.map((t) => ({
    type:  t.type,
    count: t.count,
    fill:  TYPE_COLORS[t.type] ?? "#9CA3AF",
  }));

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-6 max-w-7xl mx-auto">

      {/* ── A. Header ────────────────────────────────────────────────────────── */}
      <div>
        {/* Back link */}
        <Link
          to="/users"
          className="inline-flex items-center gap-1.5 text-sm mb-4 hover:underline"
          style={{ color: "var(--rt-accent)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--rt-text-1)" }}>
                {user.name}
              </h1>
              <Badge
                variant={user.role === ROLES.ADMIN ? "default" : "secondary"}
                style={
                  user.role === ROLES.ADMIN
                    ? { background: "#F97316", color: "#fff" }
                    : undefined
                }
              >
                {user.role}
              </Badge>
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--rt-text-2)" }}>
              {user.email}
            </p>
          </div>

          {/* Action buttons — hidden on print */}
          <div className="flex items-center gap-2 no-print">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(recentTickets, user.name)}
              className="flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── B. KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total Assigned" value={summary.totalAssigned} />
        <KpiCard label="Total Closed"   value={summary.totalClosed} />
        <KpiCard label="Avg Resolution" value={formatResolution(summary.avgResolutionMs)} />
        <KpiCard label="Avg Rating"     value={formatRating(summary.avgRating, summary.ratedCount)} />
      </div>

      {/* ── C. Monthly Trend + Status Distribution ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 1 — Monthly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--rt-text-2)" }}>
              Monthly Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rt-border)" />
                <XAxis
                  dataKey="month"
                  fontSize={11}
                  fill="var(--rt-text-3)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                />
                <YAxis
                  fontSize={11}
                  fill="var(--rt-text-3)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  allowDecimals={false}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="opened" fill="#3B82F6" radius={[3, 3, 0, 0]} name="Opened" />
                <Bar dataKey="closed" fill="#22C55E" radius={[3, 3, 0, 0]} name="Closed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2 — Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--rt-text-2)" }}>
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={Math.max(byStatus.length * 44, 160)}
            >
              <BarChart
                data={statusChartData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  fontSize={11}
                  fill="var(--rt-text-3)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  fontSize={11}
                  fill="var(--rt-text-3)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  width={90}
                />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── D. Project Breakdown + Ticket Type ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 3 — Project Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--rt-text-2)" }}>
              Project Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={Math.max(projectChartData.length * 44, 120)}
            >
              <BarChart
                data={projectChartData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  fontSize={11}
                  fill="var(--rt-text-3)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="project"
                  fontSize={11}
                  fill="var(--rt-text-3)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  width={100}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#F97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 4 — Ticket Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--rt-text-2)" }}>
              Ticket Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer
              width="100%"
              height={Math.max(typeChartData.length * 44, 120)}
            >
              <BarChart
                data={typeChartData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  fontSize={11}
                  fill="var(--rt-text-3)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="type"
                  fontSize={11}
                  fill="var(--rt-text-3)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--rt-text-3)" }}
                  width={90}
                />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {typeChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── E. Recent Tickets Table ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--rt-text-2)" }}>
            Recent Tickets (last 30)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader style={{ background: "var(--rt-surface-2)" }}>
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Ticket ID</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Title</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Priority</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Project</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Resolution</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wide" style={{ color: "var(--rt-text-1)" }}>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No tickets found.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentTickets.map((ticket) => {
                    const statusColor = STATUS_COLORS[ticket.status] ?? "#6B7280";
                    return (
                      <TableRow key={ticket.ticketId}>
                        <TableCell className="font-mono text-xs" style={{ color: "var(--rt-text-2)" }}>
                          {ticket.ticketId}
                        </TableCell>
                        <TableCell
                          className="max-w-[220px] truncate"
                          title={ticket.title}
                          style={{ color: "var(--rt-text-1)" }}
                        >
                          {ticket.title}
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: `${statusColor}18`,
                              color: statusColor,
                            }}
                          >
                            {STATUS_LABELS[ticket.status] ?? ticket.status}
                          </span>
                        </TableCell>
                        <TableCell style={{ color: "var(--rt-text-2)" }}>
                          {ticket.priority}
                        </TableCell>
                        <TableCell style={{ color: "var(--rt-text-2)" }}>
                          {ticket.project ?? "—"}
                        </TableCell>
                        <TableCell style={{ color: "var(--rt-text-2)" }}>
                          {ticket.resolutionDays != null ? `${ticket.resolutionDays}d` : "—"}
                        </TableCell>
                        <TableCell style={{ color: "var(--rt-text-2)" }}>
                          {ticket.rating != null ? `★ ${ticket.rating}` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
