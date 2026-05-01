import { z } from "zod";

// ──────────────────────────────────────
// Constants
// ──────────────────────────────────────

export const TICKET_TYPES = ["BUG", "REQUIREMENT", "TASK", "SUPPORT", "EXPLANATION", "IMPLEMENTATION"] as const;
export const PRIORITIES   = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const STATUSES     = ["UN_ASSIGNED", "OPEN_NOT_STARTED", "OPEN_IN_PROGRESS", "OPEN_QA", "OPEN_DONE", "WAITING_FOR_CLIENT", "CLOSED", "SUBMITTED", "ADMIN_REVIEW", "PLANNING", "CUSTOMER_APPROVAL", "APPROVED", "REOPENED"] as const;

export type TicketTypeValue = (typeof TICKET_TYPES)[number];
export type PriorityValue   = (typeof PRIORITIES)[number];
export type StatusValue     = (typeof STATUSES)[number];

// Named constants — use these instead of string literals
export const TICKET_TYPE = {
  BUG:            "BUG",
  REQUIREMENT:    "REQUIREMENT",
  TASK:           "TASK",
  SUPPORT:        "SUPPORT",
  EXPLANATION:    "EXPLANATION",
  IMPLEMENTATION: "IMPLEMENTATION",
} as const satisfies Record<string, TicketTypeValue>;

export const PRIORITY = {
  LOW:      "LOW",
  MEDIUM:   "MEDIUM",
  HIGH:     "HIGH",
  CRITICAL: "CRITICAL",
} as const satisfies Record<string, PriorityValue>;

export const STATUS = {
  UN_ASSIGNED:        "UN_ASSIGNED",
  OPEN_NOT_STARTED:   "OPEN_NOT_STARTED",
  OPEN_IN_PROGRESS:   "OPEN_IN_PROGRESS",
  OPEN_QA:            "OPEN_QA",
  OPEN_DONE:          "OPEN_DONE",
  WAITING_FOR_CLIENT: "WAITING_FOR_CLIENT",
  CLOSED:             "CLOSED",
  SUBMITTED:          "SUBMITTED",
  ADMIN_REVIEW:       "ADMIN_REVIEW",
  PLANNING:           "PLANNING",
  CUSTOMER_APPROVAL:  "CUSTOMER_APPROVAL",
  APPROVED:           "APPROVED",
  REOPENED:           "REOPENED",
} as const satisfies Record<string, StatusValue>;

// ──────────────────────────────────────
// API response schema
// Used by the client to validate data returned from GET /api/tickets
// ──────────────────────────────────────

export const apiTicketSchema = z.object({
  id:          z.string(),
  ticketId:    z.string(),
  title:       z.string(),
  description: z.string(),
  type:        z.enum(TICKET_TYPES),
  priority:    z.enum(PRIORITIES),
  status:      z.enum(STATUSES),
  project:     z.string(),
  senderName:  z.string().nullable().optional(),
  senderEmail: z.string().nullable().optional(),
  assignedTo:  z.object({ id: z.string(), name: z.string() }).nullable(),
  createdBy:   z.object({ id: z.string(), name: z.string() }),
  createdAt:            z.string(),
  updatedAt:            z.string(),
  lastCustomerReplyAt:  z.string().nullable().optional(),
  hrmsClientId:         z.string().nullable().optional(),
  hrmsClientName:       z.string().nullable().optional(),
  hrmsProjectId:        z.string().nullable().optional(),
  hrmsProjectName:      z.string().nullable().optional(),
  rating:               z.number().int().min(1).max(5).nullable().optional(),
  ratingText:           z.string().nullable().optional(),
  estimatedHours:       z.number().nullable().optional(),
  actualHours:          z.number().nullable().optional(),
  attachments:          z.array(z.object({
    id:        z.string(),
    filename:  z.string(),
    mimetype:  z.string(),
    size:      z.number(),
    url:       z.string(),
    createdAt: z.string(),
  })).optional().default([]),
  implementationRequest: z.object({
    businessGoal:            z.string(),
    currentPain:             z.string(),
    expectedOutcome:         z.string(),
    targetDate:              z.string().nullable(),
    planContent:             z.string().nullable(),
    planPostedAt:            z.string().nullable(),
    customerApprovedAt:      z.string().nullable(),
    customerRejectedAt:      z.string().nullable(),
    customerRejectionReason: z.string().nullable(),
  }).nullable().optional(),
});

export const apiTicketsSchema = z.array(apiTicketSchema);
export type ApiTicket = z.infer<typeof apiTicketSchema>;

// ──────────────────────────────────────
// Sorting
// ──────────────────────────────────────

export const SORTABLE_COLUMNS = ["ticketId", "title", "type", "priority", "status", "project", "createdAt"] as const;
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const ticketSortSchema = z.object({
  sortBy:    z.enum(SORTABLE_COLUMNS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type TicketSort = z.infer<typeof ticketSortSchema>;

// ──────────────────────────────────────
// Filtering
// ──────────────────────────────────────

export const ticketFilterSchema = z.object({
  search:       z.string().max(200, "Search term must be 200 characters or fewer").optional(),
  status:       z.enum(STATUSES).optional(),
  priority:     z.enum(PRIORITIES).optional(),
  type:         z
    .union([z.enum(TICKET_TYPES), z.array(z.enum(TICKET_TYPES))])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : v ? [v] : undefined)),
  assignedToId: z.string().optional(),   // user UUID or "unassigned"
  clientId:     z.string().optional(),   // hrmsClientId value
  from:         z.string().optional(),   // ISO date string
  to:           z.string().optional(),   // ISO date string
});
export type TicketFilter = z.infer<typeof ticketFilterSchema>;

// ──────────────────────────────────────
// Pagination
// ──────────────────────────────────────

export const paginationSchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const ticketQuerySchema = ticketSortSchema.merge(ticketFilterSchema).merge(paginationSchema);
export type TicketQuery = z.infer<typeof ticketQuerySchema>;

// ──────────────────────────────────────
// Paginated response
// ──────────────────────────────────────

export const paginatedTicketsSchema = z.object({
  data:       apiTicketsSchema,
  total:      z.number(),
  page:       z.number(),
  pageSize:   z.number(),
  totalPages: z.number(),
});
export type PaginatedTickets = z.infer<typeof paginatedTicketsSchema>;

// ──────────────────────────────────────
// Inbound email webhook schema
// Used by POST /api/webhooks/email
// ──────────────────────────────────────

export const inboundEmailSchema = z.object({
  from:         z.string().email("Must be a valid email address"),
  name:         z.string().max(255).optional(),
  subject:      z.string().min(1, "Subject is required").max(255, "Subject must be 255 characters or fewer"),
  body:         z.string().min(1, "Body is required").max(10000, "Body must be 10000 characters or fewer"),
  project:      z.string().min(1).max(100).optional(),
  hrmsClientId: z.string().optional(), // Used internally for test ticket setup
});

export type InboundEmail = z.infer<typeof inboundEmailSchema>;

// ──────────────────────────────────────
// Assignable users
// Slim shape returned by GET /api/tickets/assignable-users
// Only id + name — no email, role, or other sensitive fields
// ──────────────────────────────────────

export const assignableUserSchema = z.object({
  id:   z.string(),
  name: z.string(),
});
export const assignableUsersSchema = z.array(assignableUserSchema);
export type AssignableUser = z.infer<typeof assignableUserSchema>;

// ──────────────────────────────────────
// Assign ticket mutation schema
// Used by PATCH /api/tickets/:id/assignee
// ──────────────────────────────────────

export const assignTicketSchema = z.object({
  assignedToId: z.string().uuid("assignedToId must be a valid UUID").nullable(), // null = unassign
});
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

// ──────────────────────────────────────
// Update status / type mutation schemas
// Used by PATCH /api/tickets/:id/status and /api/tickets/:id/type
// ──────────────────────────────────────

export const updateStatusSchema = z.object({
  status: z.enum(STATUSES),
});
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const updateTypeSchema = z.object({
  type: z.enum(TICKET_TYPES),
});
export type UpdateTypeInput = z.infer<typeof updateTypeSchema>;

export const updatePrioritySchema = z.object({
  priority: z.enum(PRIORITIES),
});
export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;

export const updateEstimatedHoursSchema = z.object({
  estimatedHours: z.number().min(0).max(9999.99).multipleOf(0.25).nullable(),
});
export type UpdateEstimatedHoursInput = z.infer<typeof updateEstimatedHoursSchema>;

export const updateActualHoursSchema = z.object({
  actualHours: z.number().min(0).max(9999.99).multipleOf(0.25).nullable(),
});
export type UpdateActualHoursInput = z.infer<typeof updateActualHoursSchema>;

// ──────────────────────────────────────
// Portal schemas
// Used by the customer self-service portal routes (/api/portal/*)
// ──────────────────────────────────────

export const portalSubmitSchema = z.object({
  name:          z.string().min(1, "Name is required").max(255),
  email:         z.string().email("Valid email required"),
  subject:       z.string().min(1, "Subject is required").max(255),
  body:          z.string().min(1, "Description is required").max(10000),
  projectId:     z.string().optional(),
  projectName:   z.string().max(255).optional(),
  captchaToken:  z.string().max(512).optional(),   // M-6 — length-bound to prevent DoS via oversized token
  captchaAnswer: z.string().max(20).optional(),    // M-6 — length-bound captcha answer
});
export type PortalSubmitInput = z.infer<typeof portalSubmitSchema>;

export const portalSignupSchema = z.object({
  name:     z.string().min(1, "Name is required").max(128),
  email:    z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  clientId: z.string().optional(), // HRMS client ID — binds customer to their portal
});
export type PortalSignupInput = z.infer<typeof portalSignupSchema>;

export const portalRatingSchema = z.object({
  rating:     z.number().int().min(1).max(5),
  ratingText: z.string().max(1000).optional(),
});
export type PortalRatingInput = z.infer<typeof portalRatingSchema>;

// ──────────────────────────────────────
// Implementation request schemas
// Used by the implementation-request workflow (portal submit + admin actions)
// ──────────────────────────────────────

export const implementationSubmitSchema = portalSubmitSchema.extend({
  requestType:     z.literal("implementation"),
  businessGoal:    z.string().min(10).max(2000),
  currentPain:     z.string().min(10).max(2000),
  expectedOutcome: z.string().min(10).max(2000),
  targetDate:      z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
});
export type ImplementationSubmitInput = z.infer<typeof implementationSubmitSchema>;

export const implementationPlanSchema = z.object({
  planContent: z.string().min(1).max(20000),
});
export type ImplementationPlanInput = z.infer<typeof implementationPlanSchema>;

export const implementationRejectSchema = z.object({
  reason: z.string().min(1).max(2000),
});
export type ImplementationRejectInput = z.infer<typeof implementationRejectSchema>;

export const requestMoreInfoSchema = z.object({
  message: z.string().min(1).max(2000),
});
export type RequestMoreInfoInput = z.infer<typeof requestMoreInfoSchema>;

// ──────────────────────────────────────
// Status transition helper
// ──────────────────────────────────────

/**
 * Returns the legal next statuses for a ticket based on its current status and type.
 *
 * For non-IMPLEMENTATION tickets, all statuses remain legal (preserves prior behaviour).
 *
 * For IMPLEMENTATION tickets, the dropdown only exposes the *forward* neighbour per the
 * canonical workflow contract. Reverse jumps and out-of-band transitions go through
 * explicit action buttons (Post plan / Request more info / Start implementation / etc.).
 */
export function legalNextStatuses(current: StatusValue, type: TicketTypeValue): StatusValue[] {
  // For non-IMPLEMENTATION tickets, all statuses are legal (current behaviour).
  if (type !== TICKET_TYPE.IMPLEMENTATION) return [...STATUSES];

  // Workflow forward neighbours per the canonical contract:
  // SUBMITTED → ADMIN_REVIEW   (admin: Start review)
  // ADMIN_REVIEW → PLANNING    (admin: writing plan implicit)
  // PLANNING → CUSTOMER_APPROVAL (admin: Post plan)
  // CUSTOMER_APPROVAL → APPROVED  (customer: Approve)
  // APPROVED → OPEN_IN_PROGRESS  (admin: Start implementation)
  // OPEN_IN_PROGRESS → OPEN_DONE
  // OPEN_DONE → CLOSED
  // Plus SUBMITTED is reachable from any state via "Request more info" (admin button).
  // The dropdown only shows the *forward* neighbour. Other transitions go via action buttons.
  switch (current) {
    case STATUS.SUBMITTED:          return [STATUS.SUBMITTED, STATUS.ADMIN_REVIEW];
    case STATUS.ADMIN_REVIEW:       return [STATUS.ADMIN_REVIEW, STATUS.PLANNING, STATUS.SUBMITTED];
    case STATUS.PLANNING:           return [STATUS.PLANNING, STATUS.CUSTOMER_APPROVAL, STATUS.SUBMITTED];
    case STATUS.CUSTOMER_APPROVAL:  return [STATUS.CUSTOMER_APPROVAL, STATUS.APPROVED, STATUS.PLANNING, STATUS.SUBMITTED];
    case STATUS.APPROVED:           return [STATUS.APPROVED, STATUS.OPEN_IN_PROGRESS];
    case STATUS.OPEN_IN_PROGRESS:   return [STATUS.OPEN_IN_PROGRESS, STATUS.OPEN_DONE];
    case STATUS.OPEN_DONE:          return [STATUS.OPEN_DONE, STATUS.CLOSED, STATUS.REOPENED];
    case STATUS.CLOSED:             return [STATUS.CLOSED, STATUS.REOPENED];
    case STATUS.REOPENED:           return [STATUS.REOPENED, STATUS.OPEN_IN_PROGRESS];
    default:                        return [current];
  }
}
