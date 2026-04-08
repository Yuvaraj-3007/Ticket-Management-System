import { z } from "zod";

// ──────────────────────────────────────
// Constants
// ──────────────────────────────────────

export const TICKET_TYPES = ["BUG", "REQUIREMENT", "TASK", "SUPPORT"] as const;
export const PRIORITIES   = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const STATUSES     = ["NEW", "OPEN", "IN_PROGRESS", "PROCESSING", "RESOLVED", "CLOSED"] as const;

export type TicketTypeValue = (typeof TICKET_TYPES)[number];
export type PriorityValue   = (typeof PRIORITIES)[number];
export type StatusValue     = (typeof STATUSES)[number];

// Named constants — use these instead of string literals
export const TICKET_TYPE = {
  BUG:         "BUG",
  REQUIREMENT: "REQUIREMENT",
  TASK:        "TASK",
  SUPPORT:     "SUPPORT",
} as const satisfies Record<string, TicketTypeValue>;

export const PRIORITY = {
  LOW:      "LOW",
  MEDIUM:   "MEDIUM",
  HIGH:     "HIGH",
  CRITICAL: "CRITICAL",
} as const satisfies Record<string, PriorityValue>;

export const STATUS = {
  NEW:         "NEW",
  OPEN:        "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  PROCESSING:  "PROCESSING",
  RESOLVED:    "RESOLVED",
  CLOSED:      "CLOSED",
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
  search:   z.string().max(200, "Search term must be 200 characters or fewer").optional(),
  status:   z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  type:     z.enum(TICKET_TYPES).optional(),
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
  from:    z.string().email("Must be a valid email address"),
  name:    z.string().max(255).optional(),
  subject: z.string().min(1, "Subject is required").max(255, "Subject must be 255 characters or fewer"),
  body:    z.string().min(1, "Body is required").max(10000, "Body must be 10000 characters or fewer"),
  project: z.string().min(1).max(100).optional(),
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
