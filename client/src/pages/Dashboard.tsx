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

interface DailyCount {
  date: string;
  count: number;
}

interface DashboardStats {
  total: number;
  open: number;
  aiResolved: number;
  aiResolvedPercent: number;
  avgResolutionTimeMs: number;
  dailyCounts: DailyCount[];
}

function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/** Format "2026-04-06" → "Apr 6" */
function formatChartDate(iso: string): string {
  const [, month, day] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

function Dashboard() {
  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/tickets/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const statCards = stats
    ? [
        { label: "Total Tickets",       value: stats.total,                          colorClass: "text-foreground"  },
        { label: "Open Tickets",         value: stats.open,                           colorClass: "text-blue-600"    },
        { label: "AI Resolved",          value: stats.aiResolved,                     colorClass: "text-green-600"   },
        { label: "AI Resolution Rate",   value: `${stats.aiResolvedPercent}%`,        colorClass: "text-teal-600"    },
        { label: "Avg Resolution Time",  value: formatDuration(stats.avgResolutionTimeMs), colorClass: "text-orange-600" },
      ]
    : [];

  return (
    <div className="px-6 py-8">
        <div className="mb-7">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--rt-text-1)" }}>Dashboard</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--rt-text-3)" }}>Overview of your support queue performance</p>
        </div>

        {isError && (
          <p className="text-destructive mb-4">Failed to load dashboard stats.</p>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-28" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-9 w-20" />
                  </CardContent>
                </Card>
              ))
            : statCards.map(({ label, value, colorClass }) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Daily tickets bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Tickets per Day (Last 30 Days)</CardTitle>
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
    </div>
  );
}

export default Dashboard;
