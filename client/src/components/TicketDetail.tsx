import { useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  apiTicketSchema,
  assignableUsersSchema,
  type AssignableUser,
  STATUSES,
  TICKET_TYPES,
  PRIORITIES,
  type StatusValue,
  type TicketTypeValue,
  type PriorityValue,
} from "@tms/core";
import {
  priorityVariant,
  statusVariant,
  typeVariant,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-badges";
import { Sparkles } from "lucide-react";
import { EnumSelect } from "@/components/EnumSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Attachment helpers ───────────────────────────────────────────────────────

const ATTACHMENT_PREFIX_RE = /^d(\d+)_/;

function AttachmentRow({ attachments }: { attachments: Array<{ id: string; filename: string; mimetype: string; url: string }> }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {attachments.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 group"
          title={a.filename}
        >
          <div className="w-20 h-20 rounded-md border overflow-hidden bg-muted/30 flex items-center justify-center">
            {a.mimetype.startsWith("image/") ? (
              <img
                src={a.url}
                alt={a.filename}
                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
              />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-1 break-all">{a.filename}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground max-w-[80px] truncate">{a.filename.replace(ATTACHMENT_PREFIX_RE, "")}</span>
        </a>
      ))}
    </div>
  );
}

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
  const [summary, setSummary] = useState<string | null>(null);

  const summarizeMutation = useMutation({
    mutationFn: () =>
      axios.post<{ summary: string }>(
        `${API_URL}/api/tickets/${ticketId}/summarize`,
        {},
        { withCredentials: true },
      ),
    onSuccess: (res) => setSummary(res.data.summary),
  });

  const { data: ticket, isLoading, isError } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${ticketId}`, { withCredentials: true });
      return apiTicketSchema.parse(res.data);
    },
    enabled: !!ticketId,
  });

  const { data: assignableUsers = [] } = useQuery<AssignableUser[]>({
    queryKey: ["assignable-users", ticket?.hrmsProjectId ?? null],
    queryFn: async () => {
      const url = ticket?.hrmsProjectId
        ? `${API_URL}/api/tickets/assignable-users?projectId=${ticket.hrmsProjectId}`
        : `${API_URL}/api/tickets/assignable-users`;
      const res = await axios.get(url, { withCredentials: true });
      return assignableUsersSchema.parse(res.data);
    },
    enabled: !!ticket,
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

  const priorityMutation = useMutation({
    mutationFn: (priority: PriorityValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/priority`, { priority }, { withCredentials: true }),
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
        <h2 className="text-xl sm:text-2xl font-bold">{ticket.title}</h2>
      </div>

      {/* Metadata grid: project, sender, status, category, assignee, date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
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
        <DetailRow label="Priority">
          <EnumSelect
            value={ticket.priority}
            options={PRIORITIES}
            labels={PRIORITY_LABELS}
            onValueChange={(val) => priorityMutation.mutate(val)}
            disabled={priorityMutation.isPending}
            isError={priorityMutation.isError}
            errorMessage="Failed to update priority"
          />
        </DetailRow>
        <DetailRow label="Assigned to">
          <Select
            value={ticket.assignedTo?.id ?? "unassigned"}
            onValueChange={(val) => assignMutation.mutate(val === "unassigned" ? null : val)}
          >
            <SelectTrigger size="sm" className="w-full sm:w-[180px]" disabled={assignMutation.isPending}>
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
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Description</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => summarizeMutation.mutate()}
            disabled={summarizeMutation.isPending}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {summarizeMutation.isPending ? "Summarizing…" : "Summarize"}
          </Button>
        </div>
        <div className="border rounded-lg p-4 bg-muted/20">
          {(() => {
            const sections = ticket.description.split("\n\n---\n\n");
            const generalAttachments = ticket.attachments.filter((a) => !ATTACHMENT_PREFIX_RE.test(a.filename));

            if (sections.length === 1) {
              const sectionAttachments = ticket.attachments.filter((a) => {
                const m = a.filename.match(ATTACHMENT_PREFIX_RE);
                return m ? Number(m[1]) === 0 : false;
              });
              return (
                <>
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{ticket.description}</pre>
                  <AttachmentRow attachments={[...sectionAttachments, ...generalAttachments]} />
                </>
              );
            }

            return (
              <div className="space-y-4">
                {sections.map((section, idx) => {
                  const sectionAttachments = ticket.attachments.filter((a) => {
                    const m = a.filename.match(ATTACHMENT_PREFIX_RE);
                    return m ? Number(m[1]) === idx : false;
                  });
                  return (
                    <div key={idx}>
                      {idx > 0 && (
                        <>
                          <hr className="mb-3" style={{ borderColor: "var(--rt-border)" }} />
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                            Description {idx + 1}
                          </p>
                        </>
                      )}
                      <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{section}</pre>
                      <AttachmentRow attachments={sectionAttachments} />
                    </div>
                  );
                })}
                {generalAttachments.length > 0 && (
                  <div>
                    <hr className="mb-3" style={{ borderColor: "var(--rt-border)" }} />
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">Attachments</p>
                    <AttachmentRow attachments={generalAttachments} />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        {summarizeMutation.isError && (
          <p className="text-xs text-destructive mt-2">Failed to summarize. Please try again.</p>
        )}
        {summary && !summarizeMutation.isPending && (
          <div className="mt-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">AI Summary</p>
            <p className="text-sm whitespace-pre-wrap">{summary}</p>
          </div>
        )}
      </div>

      {/* Customer rating — only shown on closed tickets that have a rating */}
      {ticket.status === "CLOSED" && ticket.rating != null && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Customer Rating
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  className={`w-5 h-5 ${i < ticket.rating! ? "text-amber-400" : "text-muted-foreground/30"}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-semibold text-foreground">{ticket.rating} / 5</span>
          </div>
          {ticket.ratingText && (
            <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-amber-300 pl-3">
              "{ticket.ratingText}"
            </p>
          )}
        </div>
      )}

      {/* Closed with no rating yet */}
      {ticket.status === "CLOSED" && ticket.rating == null && (
        <div className="border rounded-lg p-4 bg-muted/20">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Customer Rating
          </h3>
          <p className="text-sm text-muted-foreground">No rating submitted yet.</p>
        </div>
      )}
    </div>
  );
}

export { TicketDetail };
