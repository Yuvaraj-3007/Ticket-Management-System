import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketReplies } from "@/components/TicketReplies";
import { ArrowLeft } from "lucide-react";

type InternalTicketDetail = {
  id:          string;
  ticketId:    string;
  title:       string;
  description: string;
  type:        string;
  priority:    string;
  status:      string;
  createdAt:   string;
  updatedAt:   string;
  assignedTo:  { id: string; name: string } | null;
  attachments: Array<{ id: string; filename: string; mimetype: string; size: number; filepath: string; createdAt: string }>;
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

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  UN_ASSIGNED:       { bg: "bg-gray-100",  text: "text-gray-600",  dot: "bg-gray-400"  },
  OPEN_NOT_STARTED:  { bg: "bg-amber-50",  text: "text-amber-700", dot: "bg-amber-400" },
  OPEN_IN_PROGRESS:  { bg: "bg-blue-50",   text: "text-blue-700",  dot: "bg-blue-500"  },
  OPEN_QA:           { bg: "bg-purple-50", text: "text-purple-700",dot: "bg-purple-500"},
  OPEN_DONE:         { bg: "bg-teal-50",   text: "text-teal-700",  dot: "bg-teal-500"  },
  WAITING_FOR_CLIENT:{ bg: "bg-orange-50", text: "text-orange-700",dot: "bg-orange-500"},
  CLOSED:            { bg: "bg-green-50",  text: "text-green-700", dot: "bg-green-500" },
  REOPENED:          { bg: "bg-red-50",    text: "text-red-700",   dot: "bg-red-500"   },
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
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function InternalTicketDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: ticket, isLoading, isError } = useQuery<InternalTicketDetail>({
    queryKey: ["internal-ticket", id],
    queryFn:  () => axios.get(`/api/internal/tickets/${id}`).then((r) => r.data),
    enabled:  !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">Ticket not found or you don't have access.</p>
        <Link to="/internal/tickets" className="text-primary text-sm underline mt-2 inline-block">Back to My Tickets</Link>
      </div>
    );
  }

  return (
    <div className="p-6" style={{ background: "var(--rt-bg)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto">

        {/* Back link */}
        <Link
          to="/internal/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          My Tickets
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <span className="font-mono text-xs text-muted-foreground pt-1">{ticket.ticketId}</span>
            <h1 className="text-lg font-semibold text-foreground flex-1">{ticket.title}</h1>
          </div>

          <div className="flex flex-wrap gap-3 mb-5 text-sm">
            <StatusBadge status={ticket.status} />
            <span className="text-muted-foreground capitalize">Type: <strong>{ticket.type.toLowerCase()}</strong></span>
            <span className="text-muted-foreground capitalize">Priority: <strong>{ticket.priority.toLowerCase()}</strong></span>
            {ticket.assignedTo && (
              <span className="text-muted-foreground">Assigned to: <strong>{ticket.assignedTo.name}</strong></span>
            )}
          </div>

          <div className="text-sm text-muted-foreground mb-1">Submitted {formatDate(ticket.createdAt)}</div>

          <div className="border-t border-border pt-4 mt-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Description</h2>
            <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </div>

        {/* Replies — reuse the existing TicketReplies component */}
        <TicketReplies ticketId={ticket.ticketId} />
      </div>
    </div>
  );
}
