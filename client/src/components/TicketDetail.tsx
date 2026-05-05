import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  apiTicketSchema,
  assignableUsersSchema,
  type AssignableUser,
  TICKET_TYPES,
  PRIORITIES,
  TICKET_TYPE,
  STATUS,
  legalNextStatuses,
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
import { Sparkles, Loader2 } from "lucide-react";
import { EnumSelect } from "@/components/EnumSelect";
import { ImplementationPanel } from "@/components/ImplementationPanel";
import { DetailRow } from "@/components/DetailRow";
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
const NO_CLIENT = NO_CLIENT;

// ─── Attachment helpers ───────────────────────────────────────────────────────

const ATTACHMENT_PREFIX_RE = /^d(\d+)_/;

function AttachmentThumb({
  a,
}: {
  a: { filename: string; mimetype: string; url: string };
}) {
  const [imgError, setImgError] = useState(false);
  const isImage = a.mimetype.startsWith("image/") && !imgError;
  return (
    <div className="w-20 h-20 rounded-md border overflow-hidden bg-muted/30 flex items-center justify-center">
      {isImage ? (
        <img
          src={a.url}
          alt={a.filename}
          className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-xs text-muted-foreground text-center px-1 break-all">
          {a.filename.replace(ATTACHMENT_PREFIX_RE, "")}
        </span>
      )}
    </div>
  );
}

function AttachmentRow({
  attachments,
}: {
  attachments: Array<{ id: string; filename: string; mimetype: string; url: string }>;
}) {
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
          <AttachmentThumb a={a} />
          <span className="text-xs text-muted-foreground max-w-[80px] truncate">
            {a.filename.replace(ATTACHMENT_PREFIX_RE, "")}
          </span>
        </a>
      ))}
    </div>
  );
}

// ─── Description body ─────────────────────────────────────────────────────────

function DescriptionBody({
  description,
  attachments,
}: {
  description: string;
  attachments: Array<{ id: string; filename: string; mimetype: string; url: string; createdAt: string; size: number }>;
}) {
  const sections = description.split("\n\n---\n\n");
  const generalAttachments = attachments.filter((a) => !ATTACHMENT_PREFIX_RE.test(a.filename));

  if (sections.length === 1) {
    const sectionAttachments = attachments.filter((a) => {
      const m = a.filename.match(ATTACHMENT_PREFIX_RE);
      return m ? Number(m[1]) === 0 : false;
    });
    return (
      <>
        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{description}</pre>
        <AttachmentRow attachments={[...sectionAttachments, ...generalAttachments]} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, idx) => {
        const sectionAttachments = attachments.filter((a) => {
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

  // Hours inputs — controlled with focus-aware sync so unrelated mutation
  // refetches never discard in-progress edits.
  const estimatedRef = useRef<HTMLInputElement>(null);
  const actualRef    = useRef<HTMLInputElement>(null);
  const [estimatedVal, setEstimatedVal] = useState("");
  const [actualVal, setActualVal]       = useState("");

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

  const { data: hrmsClients = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["hrms-clients"],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/clients`, { withCredentials: true });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [pickerClientOverride, setPickerClientOverride] = useState<string>("");
  const effectivePickerClientId = pickerClientOverride || (ticket?.hrmsClientId ?? "");

  const { data: hrmsProjects = [] } = useQuery<{ id: string; projectCode: string; projectName: string }[]>({
    queryKey: ["hrms-projects", effectivePickerClientId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/projects?clientId=${effectivePickerClientId}`, { withCredentials: true });
      return res.data;
    },
    enabled: !!effectivePickerClientId,
    staleTime: 5 * 60 * 1000,
  });

  const projectMutation = useMutation({
    mutationFn: ({ projectId, projectName, clientId, clientName }: { projectId: string; projectName: string; clientId: string; clientName: string }) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/project`, { projectId, projectName, clientId, clientName }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      axios.patch(
        `${API_URL}/api/tickets/${ticketId}/assignee`,
        { assignedToId },
        { withCredentials: true },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: StatusValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/status`, { status }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const typeMutation = useMutation({
    mutationFn: (type: TicketTypeValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/type`, { type }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: PriorityValue) =>
      axios.patch(`${API_URL}/api/tickets/${ticketId}/priority`, { priority }, { withCredentials: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const estimatedHoursMutation = useMutation({
    mutationFn: async (val: number | null) => {
      const res = await axios.patch(
        `${API_URL}/api/tickets/${ticketId}/estimated-hours`,
        { estimatedHours: val },
        { withCredentials: true },
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const actualHoursMutation = useMutation({
    mutationFn: async (val: number | null) => {
      const res = await axios.patch(
        `${API_URL}/api/tickets/${ticketId}/actual-hours`,
        { actualHours: val },
        { withCredentials: true },
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
  });

  const aiEstimateMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post(
        `${API_URL}/api/tickets/${ticketId}/estimate-hours-ai`,
        {},
        { withCredentials: true },
      );
      return res.data as { estimatedHours: number };
    },
    onSuccess: (data) => {
      estimatedHoursMutation.mutate(data.estimatedHours);
    },
  });

  // Derived server values for hours sync
  const estimatedDefault = ticket?.estimatedHours == null ? "" : String(Number(ticket.estimatedHours));
  const actualDefault    = ticket?.actualHours    == null ? "" : String(Number(ticket.actualHours));

  // Sync hours inputs from the server-confirmed value, but skip while focused
  // so that unrelated mutation refetches don't discard in-progress typing.
  useEffect(() => {
    if (document.activeElement !== estimatedRef.current) {
      setEstimatedVal(estimatedDefault);
    }
  }, [estimatedDefault]);

  useEffect(() => {
    if (document.activeElement !== actualRef.current) {
      setActualVal(actualDefault);
    }
  }, [actualDefault]);

  function commitHours(
    raw: string,
    current: number | null | undefined,
    mutate: (val: number | null) => void,
  ) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (current != null) mutate(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    if (current != null && Number(current) === parsed) return;
    mutate(parsed);
  }

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

      {/* Metadata grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
        <DetailRow label="Project">
          <div className="space-y-1.5">
            <Select
              value={effectivePickerClientId || NO_CLIENT}
              onValueChange={(val) => setPickerClientOverride(val === NO_CLIENT ? "" : val)}
            >
              <SelectTrigger size="sm" className="w-full">
                {effectivePickerClientId ? (
                  <span>{hrmsClients.find((c) => c.id === effectivePickerClientId)?.name ?? "—"}</span>
                ) : (
                  <span className="text-muted-foreground">Select client…</span>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=NO_CLIENT>
                  <span className="text-muted-foreground">— Select client —</span>
                </SelectItem>
                {hrmsClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {effectivePickerClientId && (
              <Select
                value=""
                onValueChange={(val) => {
                  const proj = hrmsProjects.find((p) => p.id === val);
                  if (!proj) return;
                  const client = hrmsClients.find((c) => c.id === effectivePickerClientId);
                  projectMutation.mutate({
                    projectId: proj.id,
                    projectName: proj.projectName,
                    clientId: effectivePickerClientId,
                    clientName: client?.name ?? "",
                  });
                }}
                disabled={projectMutation.isPending || hrmsProjects.length === 0}
              >
                <SelectTrigger size="sm" className="w-full">
                  {ticket.hrmsProjectName ? (
                    <span>
                      {ticket.hrmsProjectName}{" "}
                      <span className="text-muted-foreground">(change…)</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select project…</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {hrmsProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {projectMutation.isError && (
              <p className="text-xs text-destructive">Failed to update project</p>
            )}
          </div>
        </DetailRow>

        <DetailRow label="Created by">
          {ticket.senderName ?? ticket.createdBy.name}
        </DetailRow>

        <DetailRow label="Status">
          <EnumSelect
            value={ticket.status}
            options={legalNextStatuses(ticket.status, ticket.type) as readonly StatusValue[]}
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

        <DetailRow label="Estimated Hours">
          <div className="flex items-center gap-2">
            <input
              ref={estimatedRef}
              data-testid="estimated-hours-display"
              type="number"
              min="0"
              max="9999.99"
              step="0.25"
              value={estimatedVal}
              onChange={(e) => setEstimatedVal(e.target.value)}
              onBlur={(e) =>
                commitHours(
                  e.currentTarget.value,
                  ticket.estimatedHours ?? null,
                  (v) => estimatedHoursMutation.mutate(v),
                )
              }
              disabled={estimatedHoursMutation.isPending || aiEstimateMutation.isPending}
              placeholder="—"
              aria-label="Estimated hours"
              className="h-9 px-3 rounded-md border border-border bg-background text-sm w-[100px] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => aiEstimateMutation.mutate()}
              disabled={aiEstimateMutation.isPending || estimatedHoursMutation.isPending}
              title="AI estimate"
              aria-label="AI estimate"
              className="inline-flex items-center gap-1 h-9 px-2 rounded-md border border-border bg-secondary text-secondary-foreground text-xs hover:bg-secondary/80 disabled:opacity-50"
            >
              {aiEstimateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI
            </button>
            {estimatedHoursMutation.isPending && !aiEstimateMutation.isPending && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
          </div>
          {estimatedHoursMutation.isError && (
            <p className="text-xs text-destructive mt-1">Failed to update estimated hours</p>
          )}
          {aiEstimateMutation.isError && (
            <p className="text-xs text-destructive mt-1">Failed to get AI estimate</p>
          )}
        </DetailRow>

        <DetailRow label="Actual Hours">
          <div className="flex items-center gap-2">
            <input
              ref={actualRef}
              data-testid="actual-hours-display"
              type="number"
              min="0"
              max="9999.99"
              step="0.25"
              value={actualVal}
              onChange={(e) => setActualVal(e.target.value)}
              onBlur={(e) =>
                commitHours(
                  e.currentTarget.value,
                  ticket.actualHours ?? null,
                  (v) => actualHoursMutation.mutate(v),
                )
              }
              disabled={actualHoursMutation.isPending}
              placeholder="—"
              aria-label="Actual hours"
              className="h-9 px-3 rounded-md border border-border bg-background text-sm w-[100px] disabled:opacity-50"
            />
            {actualHoursMutation.isPending && (
              <span className="text-xs text-muted-foreground">Saving…</span>
            )}
            {ticket.actualHours != null &&
              ticket.estimatedHours != null &&
              Number(ticket.actualHours) > Number(ticket.estimatedHours) * 1.2 && (
                <Badge variant="destructive" className="ml-2 text-[10px]">
                  Over estimate
                </Badge>
              )}
          </div>
          {actualHoursMutation.isError && (
            <p className="text-xs text-destructive mt-1">Failed to update actual hours</p>
          )}
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

      {/* Implementation request workflow panel — admin side */}
      {ticket.type === TICKET_TYPE.IMPLEMENTATION && <ImplementationPanel ticket={ticket} />}

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
          <DescriptionBody description={ticket.description} attachments={ticket.attachments} />
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
      {ticket.status === STATUS.CLOSED && ticket.rating != null && (
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

      {ticket.status === STATUS.CLOSED && ticket.rating == null && (
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
