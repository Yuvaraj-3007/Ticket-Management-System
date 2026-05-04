import {
  TICKET_TYPE,
  PRIORITY,
  STATUS,
  type ApiTicket,
  type TicketTypeValue,
  type PriorityValue,
  type StatusValue,
} from "@tms/core";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function priorityVariant(p: ApiTicket["priority"]): BadgeVariant {
  if (p === PRIORITY.CRITICAL || p === PRIORITY.HIGH) return "destructive";
  if (p === PRIORITY.MEDIUM) return "default";
  return "secondary";
}

export function statusVariant(s: ApiTicket["status"]): BadgeVariant {
  if (s === STATUS.OPEN_IN_PROGRESS || s === STATUS.OPEN_QA || s === STATUS.ADMIN_REVIEW || s === STATUS.CUSTOMER_APPROVAL) return "default";
  if (s === STATUS.UN_ASSIGNED || s === STATUS.OPEN_NOT_STARTED || s === STATUS.WAITING_FOR_CLIENT || s === STATUS.SUBMITTED || s === STATUS.PLANNING) return "secondary";
  if (s === STATUS.REOPENED) return "destructive";
  return "outline";
}

export function typeVariant(t: ApiTicket["type"]): BadgeVariant {
  if (t === TICKET_TYPE.BUG) return "destructive";
  if (t === TICKET_TYPE.SUPPORT) return "default";
  if (t === TICKET_TYPE.IMPLEMENTATION) return "outline";
  return "secondary";
}

export const CATEGORY_LABELS: Record<TicketTypeValue, string> = {
  [TICKET_TYPE.BUG]:            "Bug",
  [TICKET_TYPE.REQUIREMENT]:    "Requirement",
  [TICKET_TYPE.TASK]:           "Task",
  [TICKET_TYPE.SUPPORT]:        "Support",
  [TICKET_TYPE.EXPLANATION]:    "Explanation",
  [TICKET_TYPE.IMPLEMENTATION]: "New Requirement",
};

// Additive className applied alongside the badge variant returned by typeVariant().
// Lets IMPLEMENTATION read distinctly without expanding the BadgeVariant union.
export const CATEGORY_CLASS: Partial<Record<TicketTypeValue, string>> = {
  [TICKET_TYPE.IMPLEMENTATION]:
    "text-indigo-600 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400",
};

export const PRIORITY_LABELS: Record<PriorityValue, string> = {
  [PRIORITY.LOW]:      "Low",
  [PRIORITY.MEDIUM]:   "Medium",
  [PRIORITY.HIGH]:     "High",
  [PRIORITY.CRITICAL]: "Critical",
};

export const STATUS_LABELS: Record<StatusValue, string> = {
  [STATUS.UN_ASSIGNED]:        "Un-Assigned",
  [STATUS.OPEN_NOT_STARTED]:   "Not Started",
  [STATUS.OPEN_IN_PROGRESS]:   "In Progress",
  [STATUS.OPEN_QA]:            "QA",
  [STATUS.OPEN_DONE]:          "Done",
  [STATUS.WAITING_FOR_CLIENT]: "Waiting for Client",
  [STATUS.CLOSED]:             "Closed",
  [STATUS.SUBMITTED]:          "Submitted",
  [STATUS.ADMIN_REVIEW]:       "In Review",
  [STATUS.PLANNING]:           "Planning",
  [STATUS.CUSTOMER_APPROVAL]:  "Awaiting Approval",
  [STATUS.APPROVED]:           "Approved",
  [STATUS.REOPENED]:           "Reopened",
};
