import axios from "axios";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  apiTicketSchema,
  assignableUsersSchema,
  type AssignableUser,
  STATUSES,
  TICKET_TYPES,
  type StatusValue,
  type TicketTypeValue,
} from "@tms/core";
import {
  priorityVariant,
  statusVariant,
  typeVariant,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import { EnumSelect } from "@/components/EnumSelect";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Detail row helper ────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TicketDetailProps {
  /** Human-readable ticket ID, e.g. "TKT-0001" */
  ticketId: string;
}

/**
 * Displays a ticket's basic details: header (id, badges, title),
 * metadata grid (project, sender, status, category, assignee, date),
 * and description. Does not include the reply thread.
 */
function TicketDetail({ ticketId }: TicketDetailProps) {
  const queryClient = useQueryClient();

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${ticketId}`, { withCredentials: true });
      return apiTicketSchema.parse(res.data);
    },
    enabled: !!ticketId,
  });

  const { data: assignableUsers = [] } = useQuery<AssignableUser[]>({
    queryKey: ["assignable-users"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/assignable-users`, { withCredentials: true });
      return assignableUsersSchema.parse(res.data);
    },
    staleTime: 60_000,
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      axios.patch(
        `${API_URL}/api/tickets/${ticketId}/assignee`,
        { assignedToId },
        { withCredentials: true },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: StatusValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/status`, { status }, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
  });

  const typeMutation = useMutation({
    mutationFn: (type: TicketTypeValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/type`, { type }, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md">
        Failed to load ticket. It may not exist or you may not have access.
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-6">
      {/* Header: ticketId, type/priority/status badges, title */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-sm text-muted-foreground">{ticket.ticketId}</span>
          <div className="flex gap-2">
            <Badge variant={typeVariant(ticket.type)}>{CATEGORY_LABELS[ticket.type]}</Badge>
            <Badge variant={priorityVariant(ticket.priority)}>{PRIORITY_LABELS[ticket.priority]}</Badge>
            <Badge variant={statusVariant(ticket.status)}>{STATUS_LABELS[ticket.status]}</Badge>
          </div>
        </div>
        <h2 className="text-2xl font-bold">{ticket.title}</h2>
      </div>

      {/* Metadata grid: project, sender, status, category, assignee, date */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
        <DetailRow label="Project">{ticket.project}</DetailRow>
        <DetailRow label="Created by">{ticket.createdBy.name}</DetailRow>
        <DetailRow label="Status">
          <EnumSelect
            value={ticket.status}
            options={STATUSES}
            labels={STATUS_LABELS}
            onValueChange={(val) => statusMutation.mutate(val)}
            disabled={statusMutation.isPending}
            isError={statusMutation.isError}
            errorMessage="Failed to update status"
          />
        </DetailRow>
        <DetailRow label="Category">
          <EnumSelect
            value={ticket.type}
            options={TICKET_TYPES}
            labels={CATEGORY_LABELS}
            onValueChange={(val) => typeMutation.mutate(val)}
            disabled={typeMutation.isPending}
            isError={typeMutation.isError}
            errorMessage="Failed to update category"
          />
        </DetailRow>
        <DetailRow label="Assigned to">
          <Select
            value={ticket.assignedTo?.id ?? "unassigned"}
            onValueChange={(val) => assignMutation.mutate(val === "unassigned" ? null : val)}
          >
            <SelectTrigger size="sm" className="w-[180px]" disabled={assignMutation.isPending}>
              {ticket.assignedTo
                ? <span>{ticket.assignedTo.name}</span>
                : <span className="text-muted-foreground">Unassigned</span>
              }
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">
                <span className="text-muted-foreground">Unassigned</span>
              </SelectItem>
              {assignableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignMutation.isError && (
            <p className="text-xs text-destructive mt-1">Failed to update assignee</p>
          )}
        </DetailRow>
        <DetailRow label="Created">
          {new Date(ticket.createdAt).toLocaleString(undefined, {
            year: "numeric", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit",
          })}
        </DetailRow>
      </div>

      {/* Description / message body */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">Description</h3>
        <div className="border rounded-lg p-4 bg-muted/20">
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{ticket.description}</pre>
        </div>
      </div>
    </div>
  );
}

export { TicketDetail };
