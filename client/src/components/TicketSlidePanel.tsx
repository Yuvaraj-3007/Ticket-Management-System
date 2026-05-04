import { useEffect } from "react";
import { Link } from "react-router-dom";
import { X, ExternalLink } from "lucide-react";
import type { ApiTicket } from "@tms/core";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/ticket-badges";
import { STATUS_CONFIG } from "@/lib/status-config";
import { Button } from "@/components/ui/button";

interface TicketSlidePanelProps {
  ticket: ApiTicket | null;
  onClose: () => void;
}

export function TicketSlidePanel({ ticket, onClose }: TicketSlidePanelProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const cfg = ticket ? (STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.CLOSED) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:   "fixed",
          inset:      0,
          zIndex:     40,
          background: "rgba(0,0,0,0.30)",
          opacity:    ticket ? 1 : 0,
          pointerEvents: ticket ? "auto" : "none",
          transition: "opacity 300ms ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:   "fixed",
          top:        0,
          right:      0,
          zIndex:     50,
          height:     "100%",
          width:      "min(420px, 90vw)",
          background: "var(--rt-surface)",
          borderLeft: "1px solid var(--rt-border)",
          boxShadow:  "-4px 0 24px rgba(0,0,0,0.12)",
          display:    "flex",
          flexDirection: "column",
          transform:  ticket ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease-in-out",
          overflowY:  "auto",
        }}
      >
        {ticket && (
          <>
            {/* Header */}
            <div
              style={{
                padding:       "16px 20px",
                borderBottom:  "1px solid var(--rt-border)",
                display:       "flex",
                flexDirection: "column",
                gap:           "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: "var(--rt-accent)" }}
                >
                  {ticket.ticketId}
                </span>
                <button
                  onClick={onClose}
                  style={{
                    display:         "flex",
                    alignItems:      "center",
                    justifyContent:  "center",
                    width:           "28px",
                    height:          "28px",
                    borderRadius:    "6px",
                    background:      "transparent",
                    border:          "none",
                    cursor:          "pointer",
                    color:           "var(--rt-text-3)",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--rt-surface-2)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h2
                className="text-sm font-semibold line-clamp-2"
                style={{ color: "var(--rt-text-1)", lineHeight: "1.4" }}
              >
                {ticket.title}
              </h2>

              {/* Status badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold self-start"
                style={{ background: cfg!.bg, color: cfg!.text }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: cfg!.dot }}
                />
                {STATUS_LABELS[ticket.status]}
              </span>
            </div>

            {/* Metadata */}
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                flex: 1,
              }}
            >
              <MetaRow label="Type"     value={CATEGORY_LABELS[ticket.type]} />
              <MetaRow label="Priority" value={PRIORITY_LABELS[ticket.priority]} />
              <MetaRow label="Project"  value={ticket.hrmsProjectName ?? ticket.project ?? "—"} />
              <MetaRow label="Assigned" value={ticket.assignedTo?.name ?? "Unassigned"} />
              <MetaRow label="From"     value={ticket.senderName ?? ticket.createdBy.name} />
              <MetaRow
                label="Created"
                value={new Date(ticket.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              />

              {/* Description */}
              {ticket.description && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--rt-text-3)" }}>
                    Description
                  </span>
                  <p
                    className="text-xs"
                    style={{
                      color:      "var(--rt-text-2)",
                      lineHeight: "1.6",
                      maxHeight:  "120px",
                      overflow:   "hidden",
                      whiteSpace: "pre-wrap",
                      wordBreak:  "break-word",
                    }}
                  >
                    {ticket.description.length > 300
                      ? ticket.description.slice(0, 300) + "…"
                      : ticket.description}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding:    "16px 20px",
                borderTop:  "1px solid var(--rt-border)",
                flexShrink: 0,
              }}
            >
              <Link to={`/tickets/${ticket.ticketId}`} style={{ textDecoration: "none" }}>
                <Button className="w-full gap-2" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Full Ticket
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
      <span
        className="text-xs font-semibold uppercase tracking-widest flex-shrink-0"
        style={{ color: "var(--rt-text-3)", width: "68px" }}
      >
        {label}
      </span>
      <span className="text-xs" style={{ color: "var(--rt-text-2)" }}>
        {value}
      </span>
    </div>
  );
}
