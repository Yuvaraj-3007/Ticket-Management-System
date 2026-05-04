import { useState } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { STATUS, type ApiTicket } from "@tms/core";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const API_URL = import.meta.env.VITE_API_URL || "";

const STAGES = [
  { key: STATUS.SUBMITTED,         label: "Submitted"  },
  { key: STATUS.ADMIN_REVIEW,      label: "Review"     },
  { key: STATUS.PLANNING,          label: "Planning"   },
  { key: STATUS.CUSTOMER_APPROVAL, label: "Approval"   },
  { key: STATUS.APPROVED,          label: "Approved"   },
] as const;

function StageIndicator({ status }: { status: ApiTicket["status"] }) {
  const order = STAGES.findIndex((s) => s.key === status);
  const reachedOrder =
    status === STATUS.OPEN_IN_PROGRESS || status === STATUS.OPEN_DONE || status === STATUS.CLOSED
      ? STAGES.length - 1
      : order;

  return (
    <div className="flex items-center gap-2 text-xs">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i <= reachedOrder ? "bg-indigo-600" : "bg-muted-foreground/30"
            }`}
          />
          <span className={i <= reachedOrder ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
          {i < STAGES.length - 1 && <span className="text-muted-foreground/40 mx-1">→</span>}
        </div>
      ))}
    </div>
  );
}

interface Props {
  ticket: ApiTicket;
}

export function ImplementationPanel({ ticket }: Props) {
  const qc = useQueryClient();
  const ir = ticket.implementationRequest;

  // All hooks declared unconditionally before any early return so the
  // hook-call order stays stable across renders (rules-of-hooks).
  const [planDraft,    setPlanDraft]    = useState(ir?.planContent ?? "");
  const [moreInfoMsg,  setMoreInfoMsg]  = useState("");
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketId] });

  const startReview = useMutation({
    mutationFn: () => axios.post(`${API_URL}/api/tickets/${ticket.ticketId}/start-review`, {}, { withCredentials: true }),
    onSuccess:  invalidate,
  });

  const postPlan = useMutation({
    mutationFn: (planContent: string) =>
      axios.post(`${API_URL}/api/tickets/${ticket.ticketId}/implementation-plan`, { planContent }, { withCredentials: true }),
    onSuccess:  invalidate,
  });

  const requestMoreInfo = useMutation({
    mutationFn: (message: string) =>
      axios.post(`${API_URL}/api/tickets/${ticket.ticketId}/request-more-info`, { message }, { withCredentials: true }),
    onSuccess: () => { setMoreInfoOpen(false); setMoreInfoMsg(""); invalidate(); },
  });

  const startImplementation = useMutation({
    mutationFn: () => axios.post(`${API_URL}/api/tickets/${ticket.ticketId}/start-implementation`, {}, { withCredentials: true }),
    onSuccess:  invalidate,
  });

  // Early return AFTER all hooks
  if (!ir) return null;

  const fmtDate = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <div className="border rounded-lg bg-indigo-50/40 dark:bg-indigo-950/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          New Requirement
        </h3>
        <StageIndicator status={ticket.status} />
      </div>

      {/* Read-only structured fields from customer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase">Business goal</div>
          <p className="whitespace-pre-wrap">{ir.businessGoal}</p>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase">Current pain</div>
          <p className="whitespace-pre-wrap">{ir.currentPain}</p>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase">Expected outcome</div>
          <p className="whitespace-pre-wrap">{ir.expectedOutcome}</p>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase">Target date</div>
          <p>{fmtDate(ir.targetDate)}</p>
        </div>
      </div>

      {/* Customer rejection callout */}
      {ir.customerRejectedAt && ir.customerRejectionReason && (
        <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm">
          <div className="font-medium text-red-800 dark:text-red-300">Customer requested changes</div>
          <p className="text-red-700 dark:text-red-200 whitespace-pre-wrap">{ir.customerRejectionReason}</p>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">{fmtDate(ir.customerRejectedAt)}</div>
        </div>
      )}

      {/* Customer approval callout */}
      {ir.customerApprovedAt && (
        <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-sm">
          <span className="font-medium text-green-800 dark:text-green-300">Customer approved</span>
          <span className="text-green-700 dark:text-green-200 ml-2">{fmtDate(ir.customerApprovedAt)}</span>
        </div>
      )}

      {/* Plan editor */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Implementation plan</label>
        <Textarea
          value={planDraft}
          onChange={(e) => setPlanDraft(e.target.value)}
          rows={6}
          placeholder="Outline the approach, milestones, and deliverables…"
          className="text-sm"
        />
        {ir.planPostedAt && (
          <p className="text-xs text-muted-foreground">Plan last posted {fmtDate(ir.planPostedAt)}</p>
        )}
      </div>

      {/* Action buttons depending on status */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        {ticket.status === STATUS.SUBMITTED && (
          <Button size="sm" onClick={() => startReview.mutate()} disabled={startReview.isPending}>
            {startReview.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Start review
          </Button>
        )}

        {(ticket.status === STATUS.ADMIN_REVIEW || ticket.status === STATUS.PLANNING || ticket.status === STATUS.CUSTOMER_APPROVAL) && (
          <Button
            size="sm"
            onClick={() => postPlan.mutate(planDraft)}
            disabled={postPlan.isPending || planDraft.trim().length === 0}
          >
            {postPlan.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {ir.planContent ? "Update plan & re-send" : "Post plan to customer"}
          </Button>
        )}

        <Button size="sm" variant="outline" onClick={() => setMoreInfoOpen(true)}>Request more info</Button>
        <Dialog open={moreInfoOpen} onOpenChange={setMoreInfoOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Request more info from customer</DialogTitle></DialogHeader>
            <Textarea
              value={moreInfoMsg}
              onChange={(e) => setMoreInfoMsg(e.target.value)}
              rows={4}
              placeholder="What do you need to know?"
            />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setMoreInfoOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => requestMoreInfo.mutate(moreInfoMsg)}
                disabled={requestMoreInfo.isPending || moreInfoMsg.trim().length === 0}
              >
                {requestMoreInfo.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {ticket.status === STATUS.APPROVED && (
          <Button size="sm" onClick={() => startImplementation.mutate()} disabled={startImplementation.isPending}>
            {startImplementation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Start implementation
          </Button>
        )}
      </div>
    </div>
  );
}
