import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type InternalTicket = {
  id:        string;
  ticketId:  string;
  title:     string;
  type:      string;
  priority:  string;
  status:    string;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
};

interface TicketsResponse {
  data:       InternalTicket[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  UN_ASSIGNED:       { bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400"   },
  OPEN_NOT_STARTED:  { bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400"  },
  OPEN_IN_PROGRESS:  { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500"   },
  OPEN_QA:           { bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-500" },
  OPEN_DONE:         { bg: "bg-teal-50",    text: "text-teal-700",   dot: "bg-teal-500"   },
  WAITING_FOR_CLIENT:{ bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500" },
  CLOSED:            { bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500"  },
  REOPENED:          { bg: "bg-red-50",     text: "text-red-700",    dot: "bg-red-500"    },
};

const STATUS_LABELS: Record<string, string> = {
  UN_ASSIGNED:        "Unassigned",
  OPEN_NOT_STARTED:   "Not Started",
  OPEN_IN_PROGRESS:   "In Progress",
  OPEN_QA:            "QA",
  OPEN_DONE:          "Done",
  WAITING_FOR_CLIENT: "Waiting for Client",
  CLOSED:             "Closed",
  REOPENED:           "Reopened",
};

const PRIORITY_STYLE: Record<string, string> = {
  LOW:      "text-gray-500",
  MEDIUM:   "text-amber-600",
  HIGH:     "text-orange-600",
  CRITICAL: "text-red-600 font-semibold",
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_TABS = [
  { value: "",                 label: "All"         },
  { value: "UN_ASSIGNED",      label: "Unassigned"  },
  { value: "OPEN_IN_PROGRESS", label: "In Progress" },
  { value: "OPEN_DONE",        label: "Done"        },
  { value: "CLOSED",           label: "Closed"      },
];

export default function InternalTickets() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<TicketsResponse>({
    queryKey: ["internal-tickets", statusFilter, page],
    queryFn:  () =>
      axios.get("/api/internal/tickets", {
        params: { status: statusFilter || undefined, page, pageSize: 20 },
      }).then((r) => r.data),
  });

  return (
    <div className="p-6" style={{ background: "var(--rt-bg)", minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Tickets</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Tickets you have submitted internally</p>
          </div>
          <Link to="/internal/submit">
            <Button className="gap-2"><Plus className="h-4 w-4" />New Ticket</Button>
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mb-4 bg-white border border-border rounded-xl p-1 w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={[
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-border rounded-xl overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : isError ? (
            <p className="p-6 text-destructive text-sm">Failed to load tickets.</p>
          ) : data?.data.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No tickets yet.{" "}
              <Link to="/internal/submit" className="text-primary underline underline-offset-2">Submit one now</Link>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-40">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">Assigned to</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.data.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.ticketId}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/internal/tickets/${t.ticketId}`}
                        className="font-medium text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors line-clamp-1"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{t.type.toLowerCase()}</td>
                    <td className={`px-4 py-3 text-xs capitalize ${PRIORITY_STYLE[t.priority] ?? ""}`}>
                      {t.priority.toLowerCase()}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{t.assignedTo?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Page {data.page} of {data.totalPages} ({data.total} tickets)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
