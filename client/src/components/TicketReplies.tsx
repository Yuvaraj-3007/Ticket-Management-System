import { useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  apiCommentsSchema,
  apiTicketSchema,
  type ApiComment,
} from "@tms/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/portal/ImageUploadField";

const API_URL = import.meta.env.VITE_API_URL || "";

const SENDER_TYPE_LABELS = {
  AGENT:    "Agent",
  CUSTOMER: "Customer",
} as const;


function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

interface TicketRepliesProps {
  ticketId: string;
}

/**
 * Self-contained reply thread + form for a single ticket.
 * Handles the comments query, reply mutation, and all local state.
 * Used on the TicketDetail page below the description section.
 */
function TicketReplies({ ticketId }: TicketRepliesProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  // Re-uses the cache populated by TicketDetail — no extra network request
  const { data: ticket } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${ticketId}`, { withCredentials: true });
      return apiTicketSchema.parse(res.data);
    },
    enabled: !!ticketId,
    staleTime: 60_000,
  });

  const { data: comments = [], isLoading } = useQuery<ApiComment[]>({
    queryKey: ["comments", ticketId],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/api/tickets/${ticketId}/comments`, { withCredentials: true });
      return apiCommentsSchema.parse(res.data);
    },
    enabled: !!ticketId,
  });

  const replyMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("content", content);
      for (const file of attachmentFiles) {
        fd.append("attachments", file);
      }
      return axios.post(`${API_URL}/api/tickets/${ticketId}/comments`, fd, { withCredentials: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
      setContent("");
      setAttachmentFiles([]);
    },
  });

  const polishMutation = useMutation({
    mutationFn: (content: string) =>
      axios.post<{ polished: string }>(
        `${API_URL}/api/tickets/${ticketId}/polish`,
        { content },
        { withCredentials: true },
      ),
    onSuccess: (res) => setContent(res.data.polished),
  });

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Replies{comments.length > 0 && ` (${comments.length})`}
      </h3>

      <div className="space-y-3 mb-4">
        {/* Original customer message — always first */}
        {ticket ? (
          <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold">
                {ticket.senderName ?? ticket.createdBy.name}
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
                    className="group relative block w-20 h-20 rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
                  >
                    <img src={att.url} alt={att.filename} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">{att.filename}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Skeleton className="h-20 w-full" />
        )}

        {/* Agent / subsequent replies */}
        {isLoading && <Skeleton className="h-16 w-full" />}

        {!isLoading && comments.map((c) => (
          <div
            key={c.id}
            className={`border rounded-lg p-4 ${c.senderType === "CUSTOMER" ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-muted/10"}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold">
                {c.senderType === "CUSTOMER"
                  ? (ticket?.senderName ?? ticket?.createdBy.name ?? c.author.name)
                  : c.author.name}
              </span>
              <Badge variant="outline" className="text-xs py-0">
                {SENDER_TYPE_LABELS[c.senderType]}
              </Badge>
              <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{c.content}</p>
            {c.attachments && c.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {c.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block w-16 h-16 rounded overflow-hidden border border-border hover:border-accent transition-colors"
                    title={att.filename}
                  >
                    <img src={att.url} alt={att.filename} className="w-full h-full object-cover" loading="lazy" />
                    <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] px-1 truncate">{att.filename}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reply form */}
      <div className="space-y-2 mt-6">
        <h3 className="text-sm font-medium mb-2">Add Reply</h3>
        <Textarea
          placeholder="Write a reply…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          disabled={replyMutation.isPending}
        />
        <ImageUploadField files={attachmentFiles} onChange={setAttachmentFiles} />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => polishMutation.mutate(content)}
            disabled={polishMutation.isPending || content.trim() === ""}
          >
            {polishMutation.isPending ? "Polishing…" : "✨ Polish"}
          </Button>
          <Button
            size="sm"
            onClick={() => replyMutation.mutate()}
            disabled={replyMutation.isPending || content.trim() === ""}
          >
            {replyMutation.isPending ? "Posting…" : "Post Reply"}
          </Button>
        </div>
        {replyMutation.isError && (
          <p className="text-xs text-destructive">Failed to post reply. Please try again.</p>
        )}
        {polishMutation.isError && (
          <p className="text-xs text-destructive">Failed to polish reply. Please try again.</p>
        )}
      </div>
    </div>
  );
}

export { TicketReplies };
