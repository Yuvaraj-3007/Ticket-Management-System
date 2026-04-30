import { useState } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { STATUS } from "@tms/core";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const API_URL = import.meta.env.VITE_API_URL || "";

const STAGES = [
  { key: STATUS.SUBMITTED,         label: "Submitted" },
  { key: STATUS.ADMIN_REVIEW,      label: "Reviewing" },
  { key: STATUS.PLANNING,          label: "Planning"  },
  { key: STATUS.CUSTOMER_APPROVAL, label: "Your turn" },
  { key: STATUS.APPROVED,          label: "Approved"  },
] as const;

function StageIndicator({ status }: { status: string }) {
  const order = STAGES.findIndex((s) => s.key === status);
  const reachedOrder =
    status === STATUS.OPEN_IN_PROGRESS || status === STATUS.OPEN_DONE || status === STATUS.CLOSED
      ? STAGES.length - 1
      : order;

  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i <= reachedOrder ? "bg-indigo-600" : "bg-gray-300"
            }`}
          />
          <span className={i <= reachedOrder ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
          {i < STAGES.length - 1 && <span className="text-muted-foreground/40 mx-1">→</span>}
        </div>
      ))}
    </div>
  );
}

export interface ImplementationRequestData {
  businessGoal:            string;
  currentPain:             string;
  expectedOutcome:         string;
  targetDate:              string | null;
  planContent:             string | null;
  planPostedAt:            string | null;
  customerApprovedAt:      string | null;
  customerRejectedAt:      string | null;
  customerRejectionReason: string | null;
}

interface Props {
  ticketId:              string;
  status:                string;
  implementationRequest: ImplementationRequestData;
}

export function ImplementationStatusPanel({ ticketId, status, implementationRequest: ir }: Props) {
  const qc = useQueryClient();

  const [rejectOpen,   setRejectOpen]   = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["portal-ticket", ticketId] });

  const approve = useMutation({
    mutationFn: () => axios.post(`${API_URL}/api/portal/tickets/${ticketId}/approve-plan`, {}, { withCredentials: true }),
    onSuccess:  invalidate,
  });

  const reject = useMutation({
    mutationFn: (reason: string) =>
      axios.post(`${API_URL}/api/portal/tickets/${ticketId}/reject-plan`, { reason }, { withCredentials: true }),
    onSuccess: () => { setRejectOpen(false); setRejectReason(""); invalidate(); },
  });

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  const canReact = status === STATUS.CUSTOMER_APPROVAL && !!ir.planContent;

  return (
    <div className="border rounded-lg bg-indigo-50/40 dark:bg-indigo-950/10 p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          New Requirement
        </h3>
        <StageIndicator status={status} />
      </div>

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

      {ir.planContent && (
        <div className="border rounded-md bg-white dark:bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
            Plan from team {ir.planPostedAt && <span className="text-muted-foreground">· posted {fmtDate(ir.planPostedAt)}</span>}
          </div>
          <p className="text-sm whitespace-pre-wrap">{ir.planContent}</p>
        </div>
      )}

      {ir.customerApprovedAt && (
        <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-sm">
          <span className="font-medium text-green-800 dark:text-green-300">You approved this plan</span>
          <span className="text-green-700 dark:text-green-200 ml-2">{fmtDate(ir.customerApprovedAt)}</span>
        </div>
      )}

      {ir.customerRejectedAt && ir.customerRejectionReason && !ir.customerApprovedAt && (
        <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-300">You requested changes</div>
          <p className="text-amber-700 dark:text-amber-200 whitespace-pre-wrap">{ir.customerRejectionReason}</p>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">{fmtDate(ir.customerRejectedAt)}</div>
        </div>
      )}

      {canReact && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
            {approve.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Approve plan
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>Request changes</Button>
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Request changes</DialogTitle></DialogHeader>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Tell the team what to revise…"
              />
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => reject.mutate(rejectReason)}
                  disabled={reject.isPending || rejectReason.trim().length === 0}
                >
                  {reject.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Send
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
