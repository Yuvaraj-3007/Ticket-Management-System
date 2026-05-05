import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ImageUploadField } from "@/components/portal/ImageUploadField";
import { statusVariant, STATUS_LABELS } from "@/lib/ticket-badges";
import { ImplementationStatusPanel, type ImplementationRequestData } from "@/components/ImplementationStatusPanel";
import { DetailRow } from "@/components/DetailRow";

// ─── Types ────────────────────────────────────────────────────────────────────

type Attachment = {
  id:        string;
  filename:  string;
  mimetype:  string;
  size:      number;
  url:       string;
  createdAt: string;
};

type PortalTicket = {
  id:              string;
  ticketId:        string;
  title:           string;
  description:     string;
  status:          string;
  priority:        string;
  type:            string;
  project:         string;
  hrmsProjectName: string | null;
  senderName:      string | null;
  senderEmail:     string;
  createdAt:       string;
  updatedAt:       string;
  rating:          number | null;
  ratingText?:     string | null;
  assignedTo:      { name: string } | null;
  attachments:     Attachment[];
  implementationRequest?: ImplementationRequestData | null;
};

type PortalComment = {
  id:          string;
  content:     string;
  senderType:  "CUSTOMER" | "AGENT" | string;
  author:      { name: string } | null;
  createdAt:   string;
  attachments?: Array<{ id: string; filename: string; url: string }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl transition-colors ${star <= value ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReadOnlyStars({ value }: { value: number }) {
  return (
    <span className="text-xl">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= value ? "text-yellow-400" : "text-gray-300"}>★</span>
      ))}
    </span>
  );
}

// ─── Rating Section ───────────────────────────────────────────────────────────

function RatingSection({ ticket }: { ticket: PortalTicket }) {
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [ratingText, setRatingText] = useState("");

  const ratingMutation = useMutation({
    mutationFn: async () => {
      await axios.patch(
        `/api/portal/tickets/${id}/rating`,
        { rating, ratingText: ratingText.trim() || undefined },
        { withCredentials: true },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["portal-ticket", id] });
    },
  });

  if (ticket.rating !== null) {
    return (
      <div className="p-5 border rounded-lg bg-muted/30">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Your Rating</h3>
        <div className="flex items-center gap-2">
          <ReadOnlyStars value={ticket.rating} />
          <span className="text-sm text-muted-foreground">({ticket.rating}/5)</span>
        </div>
        {ticket.ratingText && (
          <p className="text-sm text-muted-foreground mt-2 italic">"{ticket.ratingText}"</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-5 border rounded-lg bg-muted/30">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        How did we do? Rate this ticket
      </h3>
      <StarRating value={rating} onChange={setRating} />
      <div className="mt-3">
        <Textarea
          placeholder="Optional feedback (leave blank to skip)"
          rows={3}
          value={ratingText}
          onChange={(e) => setRatingText(e.target.value)}
          className="text-sm"
        />
      </div>
      {ratingMutation.isError && (
        <p className="text-destructive text-xs mt-2">Failed to submit rating. Please try again.</p>
      )}
      <Button
        className="mt-3"
        size="sm"
        disabled={rating === 0 || ratingMutation.isPending}
        onClick={() => ratingMutation.mutate()}
      >
        {ratingMutation.isPending ? "Submitting..." : "Submit Rating"}
      </Button>
    </div>
  );
}

// ─── Comment Thread ───────────────────────────────────────────────────────────

function CommentThread({ comments, sortAsc }: { comments: PortalComment[]; sortAsc: boolean }) {
  const sorted = sortAsc ? [...comments] : [...comments].reverse();

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {sorted.map((comment) => {
        const isCustomer = comment.senderType === "CUSTOMER";
        return (
          <div
            key={comment.id}
            className={`border rounded-lg p-4 ${
              isCustomer
                ? "bg-blue-50/50"
                : "bg-muted/10"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold">
                {comment.author?.name ?? (isCustomer ? "You" : "Support")}
              </span>
              <Badge variant="outline" className="text-xs py-0">
                {isCustomer ? "Customer" : "Agent"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            {comment.attachments && comment.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {comment.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block w-16 h-16 rounded overflow-hidden border border-gray-200 hover:border-orange-400 transition-colors"
                    title={att.filename}
                  >
                    <img src={att.url} alt={att.filename} className="w-full h-full object-cover" loading="lazy" />
                    <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 truncate">{att.filename}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortalTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sortAsc, setSortAsc] = useState(true);
  const [commentContent, setCommentContent] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  const {
    data: ticket,
    isLoading: ticketLoading,
    isError: ticketError,
  } = useQuery<PortalTicket>({
    queryKey: ["portal-ticket", id],
    queryFn: async () => {
      const res = await axios.get<PortalTicket>(`/api/portal/tickets/${id}`, { withCredentials: true });
      return res.data;
    },
    enabled: Boolean(id),
  });

  const { data: comments, isLoading: commentsLoading } = useQuery<PortalComment[]>({
    queryKey: ["portal-ticket-comments", id],
    queryFn: async () => {
      const res = await axios.get<PortalComment[]>(`/api/portal/tickets/${id}/comments`, { withCredentials: true });
      return res.data;
    },
    enabled: Boolean(id),
  });

  const reopenMutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/portal/tickets/${ticket?.ticketId}/reopen`, {}, { withCredentials: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-ticket", id] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const fd = new FormData();
      fd.append("content", content);
      for (const file of attachmentFiles) {
        fd.append("attachments", file);
      }
      await axios.post(`/api/portal/tickets/${id}/comments`, fd, { withCredentials: true });
    },
    onSuccess: () => {
      setCommentContent("");
      setAttachmentFiles([]);
      void queryClient.invalidateQueries({ queryKey: ["portal-ticket-comments", id] });
    },
  });

  if (ticketLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4">
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

  if (ticketError || !ticket) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md">
          Failed to load ticket. Please go back and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate("/portal/tickets")}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6 -ml-2")}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        My Tickets
      </button>

      <div className="space-y-8">
        {/* ── Ticket header ── */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm text-muted-foreground">{ticket.ticketId}</span>
              <div className="flex gap-2">
                <Badge variant={statusVariant(ticket.status as Parameters<typeof statusVariant>[0])}>{statusLabel(ticket.status)}</Badge>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">{ticket.title}</h2>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
            <DetailRow label="Project">
              {ticket.hrmsProjectName ?? ticket.project ?? "—"}
            </DetailRow>
            <DetailRow label="Submitted by">
              {ticket.senderName ?? ticket.senderEmail}
            </DetailRow>
            <DetailRow label="Status">
              <Badge variant={statusVariant(ticket.status as Parameters<typeof statusVariant>[0])}>{statusLabel(ticket.status)}</Badge>
            </DetailRow>
            {(ticket.status === "CLOSED" || ticket.status === "OPEN_DONE") && (
              <DetailRow label="Reopen">
                <button
                  type="button"
                  onClick={() => reopenMutation.mutate()}
                  disabled={reopenMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {reopenMutation.isPending ? "Reopening…" : "Reopen Ticket"}
                </button>
                {reopenMutation.isError && (
                  <p className="text-xs text-destructive mt-1">Failed to reopen ticket</p>
                )}
              </DetailRow>
            )}
            <DetailRow label="Created">
              {formatDate(ticket.createdAt)}
            </DetailRow>
            <DetailRow label="Last updated">
              {(() => {
                const latestComment = comments && comments.length > 0
                  ? comments.reduce((a, b) =>
                      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
                    )
                  : null;
                const effectiveUpdatedAt = latestComment
                  ? new Date(latestComment.createdAt) > new Date(ticket.updatedAt)
                    ? latestComment.createdAt
                    : ticket.updatedAt
                  : ticket.updatedAt;
                return formatDate(effectiveUpdatedAt);
              })()}
            </DetailRow>
          </div>

          {/* Implementation request workflow panel — customer side */}
          {ticket.type === "IMPLEMENTATION" && ticket.implementationRequest && (
            <ImplementationStatusPanel
              ticketId={ticket.ticketId}
              status={ticket.status}
              implementationRequest={ticket.implementationRequest}
            />
          )}

          {/* Description */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Description
            </h3>
            <div className="border rounded-lg p-4 bg-muted/20">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {ticket.description}
              </pre>
            </div>
          </div>

        </div>

        {/* ── Replies ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Replies
            </h3>
            <button
              type="button"
              onClick={() => setSortAsc((s) => !s)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {sortAsc ? "↑ Oldest first" : "↓ Newest first"}
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {/* Original message — always shown as first reply card */}
            <div className="border rounded-lg p-4 bg-blue-50/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">
                  {ticket.senderName ?? ticket.senderEmail}
                </span>
                <Badge variant="outline" className="text-xs py-0">Customer</Badge>
                <span className="text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ticket.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={att.filename}
                      className="group relative block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-orange-400 transition-colors"
                    >
                      <img src={att.url} alt={att.filename} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">{att.filename}</p>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Subsequent comments */}
            {commentsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <CommentThread comments={comments ?? []} sortAsc={sortAsc} />
            )}
          </div>

          {/* Add Reply */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium mb-2">Add Reply</h3>
            <Textarea
              placeholder="Write a reply…"
              rows={3}
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              className="text-sm"
              disabled={commentMutation.isPending}
            />
            <ImageUploadField files={attachmentFiles} onChange={setAttachmentFiles} />
            {commentMutation.isError && (
              <p className="text-destructive text-xs">Failed to post reply. Please try again.</p>
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={!commentContent.trim() || commentMutation.isPending}
                onClick={() => {
                  const trimmed = commentContent.trim();
                  if (trimmed) commentMutation.mutate(trimmed);
                }}
              >
                {commentMutation.isPending ? "Posting…" : "Post Reply"}
              </Button>
            </div>
          </div>
        </div>

        {/* Rating (CLOSED tickets only) */}
        {ticket.status === "CLOSED" && <RatingSection ticket={ticket} />}
      </div>
    </div>
  );
}
