import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalyticsData = {
  total:               number;
  byStatus:            Array<{ status: string; count: number }>;
  byType:              Array<{ type: string; count: number }>;
  byPriority:          Array<{ priority: string; count: number }>;
  agentStats:          Array<{ id: string; name: string; role: string; assignedTickets: number; commentsMade: number; closedTickets: number; avgRating: number | null }>;
  dailyVolume:         Array<{ date: string; count: number }>;
  avgResolutionHours:  number | null;
  avgRating:           number | null;
  ratedCount:          number;
  ratingDistribution:  Array<{ stars: number; count: number }>;
  byClient:            Array<{ clientId: string; clientName: string; count: number }>;
  avgResolutionByPriority: Array<{ priority: string; avgHours: number }>;
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

const PRIORITY_COLORS: Record<string, string> = {
  LOW:      "#22C55E",
  MEDIUM:   "#F59E0B",
  HIGH:     "#EF4444",
  CRITICAL: "#7C3AED",
};

const STATUS_COLORS: Record<string, string> = {
  UN_ASSIGNED:      "#9CA3AF",
  OPEN_NOT_STARTED: "#F59E0B",
  OPEN_IN_PROGRESS: "#3B82F6",
  OPEN_QA:          "#8B5CF6",
  OPEN_DONE:        "#14B8A6",
  CLOSED:           "#22C55E",
};

const TYPE_COLORS = ["#F97316", "#3B82F6", "#8B5CF6", "#22C55E"];

const OPEN_STATUSES = ["OPEN_NOT_STARTED", "OPEN_IN_PROGRESS", "OPEN_QA", "OPEN_DONE"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusCount(byStatus: AnalyticsData["byStatus"], status: string): number {
  return byStatus.find((s) => s.status === status)?.count ?? 0;
}

function getOpenCount(byStatus: AnalyticsData["byStatus"]): number {
  return OPEN_STATUSES.reduce((sum, s) => sum + getStatusCount(byStatus, s), 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent
          ? "bg-orange-500 text-white border-orange-500"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
      }`}
    >
      <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${accent ? "text-orange-100" : "text-gray-500 dark:text-gray-400"}`}>
        {label}
      </p>
      <p className={`text-3xl font-bold ${accent ? "text-white" : "text-gray-900 dark:text-gray-100"}`}>{value}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      {label && <p className="font-medium text-gray-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-gray-600">
          {p.name === "avgHours" ? `${p.value}h avg` : `${p.value} ticket${p.value !== 1 ? "s" : ""}`}
        </p>
      ))}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-5 h-5 ${i < Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
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

export default function Analytics() {
  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      const res = await axios.get<AnalyticsData>(`${API_URL}/api/analytics/overview`, {
        withCredentials: true,
      });
      return res.data;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <AnalyticsSkeleton />;

  if (isError || !data) {
    return (
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-lg">
          Failed to load analytics. Please refresh the page.
        </div>
      </div>
    );
  }

  // Derived values
  const openCount       = getOpenCount(data.byStatus);
  const closedCount     = getStatusCount(data.byStatus, "CLOSED");
  const unassignedCount = getStatusCount(data.byStatus, "UN_ASSIGNED");
  const avgResolution   = data.avgResolutionHours != null ? `${data.avgResolutionHours}h` : "N/A";

  // Chart data
  const statusChartData = data.byStatus.map((s) => ({
    name:  STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
    fill:  STATUS_COLORS[s.status] ?? "#9CA3AF",
  }));

  const priorityChartData = data.byPriority.map((p) => ({
    name:  p.priority.charAt(0) + p.priority.slice(1).toLowerCase(),
    value: p.count,
    fill:  PRIORITY_COLORS[p.priority] ?? "#9CA3AF",
  }));

  const typeChartData = data.byType.map((t, i) => ({
    name:  t.type.charAt(0) + t.type.slice(1).toLowerCase().replace(/_/g, " "),
    count: t.count,
    fill:  TYPE_COLORS[i % TYPE_COLORS.length],
  }));

  const volumeChartData = data.dailyVolume.map((d) => ({
    date:  new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: d.count,
  }));

  const ratingDistData = data.ratingDistribution.map((r) => ({
    stars: `${r.stars}★`,
    count: r.count,
  }));

  const priorityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const resolutionData = priorityOrder
    .map((p) => data.avgResolutionByPriority.find((r) => r.priority === p))
    .filter(Boolean)
    .map((r) => ({
      name:     r!.priority.charAt(0) + r!.priority.slice(1).toLowerCase(),
      avgHours: r!.avgHours,
      fill:     PRIORITY_COLORS[r!.priority] ?? "#9CA3AF",
    }));

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 space-y-10 max-w-7xl mx-auto">
      {/* Page title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Ticket activity, agent performance, and customer satisfaction</p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard label="Total Tickets"   value={data.total}      accent />
        <SummaryCard label="Open"            value={openCount}       />
        <SummaryCard label="Un-Assigned"     value={unassignedCount} />
        <SummaryCard label="Closed"          value={closedCount}     />
        <SummaryCard label="Avg Resolution"  value={avgResolution}   />
      </div>

      {/* ── Ticket Volume (last 30 days) ── */}
      {volumeChartData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <SectionHeader title="Ticket Volume (last 30 days)" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={volumeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#F97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#F97316" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Customer Satisfaction ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <SectionHeader title="Customer Satisfaction" />
        {data.avgRating != null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            {/* Avg rating display */}
            <div className="flex flex-col items-center justify-center py-4">
              <p className="text-6xl font-bold text-amber-500 mb-2">{data.avgRating}</p>
              <StarRating rating={data.avgRating} />
              <p className="text-sm text-gray-500 mt-2">
                Average from {data.ratedCount} rating{data.ratedCount !== 1 ? "s" : ""}
              </p>
            </div>
            {/* Distribution bar chart */}
            <div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={ratingDistData}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="stars"
                    tick={{ fontSize: 12, fill: "#374151" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4 text-center">No customer ratings yet.</p>
        )}
      </div>

      {/* ── Status & Priority row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <SectionHeader title="Status Breakdown" />
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                paddingAngle={2}
              >
                {statusChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} tickets`]} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <SectionHeader title="Priority Breakdown" />
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={priorityChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                paddingAngle={2}
              >
                {priorityChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} tickets`]} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top Clients + Resolution by Priority ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Clients */}
        {data.byClient.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <SectionHeader title="Top Clients" />
            <ResponsiveContainer width="100%" height={Math.max(data.byClient.length * 40, 160)}>
              <BarChart
                data={data.byClient}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="clientName"
                  tick={{ fontSize: 12, fill: "#374151" }}
                  tickLine={false}
                  axisLine={false}
                  width={130}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Avg Resolution by Priority */}
        {resolutionData.length > 0 && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <SectionHeader title="Avg Resolution Time by Priority" />
            <ResponsiveContainer width="100%" height={Math.max(resolutionData.length * 48, 160)}>
              <BarChart
                data={resolutionData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  unit="h"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#374151" }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgHours" radius={[0, 4, 4, 0]}>
                  {resolutionData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Category Breakdown ── */}
      {typeChartData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <SectionHeader title="Category Breakdown" />
          <ResponsiveContainer width="100%" height={Math.max(typeChartData.length * 48, 160)}>
            <BarChart
              data={typeChartData}
              layout="vertical"
              margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: "#374151" }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {typeChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Agent Performance ── */}
      {data.agentStats.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <SectionHeader title="Agent Performance" />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Assigned</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Closed</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Comments</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.agentStats.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-900">{agent.name}</td>
                    <td className="py-3 px-3 text-gray-500 capitalize">
                      {agent.role.charAt(0) + agent.role.slice(1).toLowerCase()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                        {agent.assignedTickets}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        {agent.closedTickets}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {agent.commentsMade}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {agent.avgRating != null ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {agent.avgRating}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
