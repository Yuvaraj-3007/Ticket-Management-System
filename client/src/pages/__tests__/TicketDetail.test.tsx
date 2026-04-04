import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  TICKET_TYPE,
  PRIORITY,
  STATUS,
  STATUSES,
  TICKET_TYPES,
  type ApiTicket,
  type AssignableUser,
  assignTicketSchema,
  assignableUserSchema,
  updateStatusSchema,
  updateTypeSchema,
} from "@tms/core";
import axios from "axios";
import TicketDetailPage from "../TicketDetailPage";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/Navbar", () => ({ default: () => <div data-testid="navbar" /> }));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { name: "Admin", role: "ADMIN" } },
    isPending: false,
  }),
  signOut: vi.fn(),
}));

vi.mock("axios");

const mockedAxios = vi.mocked(axios);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USERS: AssignableUser[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Alice Agent" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Bob Agent" },
];

const BASE_TICKET: ApiTicket = {
  id:          "ticket-db-id",
  ticketId:    "TKT-0001",
  title:       "Network Issue Troubleshooting",
  description: "Users on floor 3 cannot reach the internal wiki.",
  type:        TICKET_TYPE.SUPPORT,
  priority:    PRIORITY.HIGH,
  status:      STATUS.OPEN,
  project:     "Email Intake",
  assignedTo:  null,
  createdBy:   { id: "admin-id", name: "Admin" },
  createdAt:   "2026-04-01T10:00:00.000Z",
  updatedAt:   "2026-04-01T10:00:00.000Z",
};

const ASSIGNED_TICKET: ApiTicket = {
  ...BASE_TICKET,
  assignedTo: { id: "00000000-0000-0000-0000-000000000001", name: "Alice Agent" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderDetail(ticketId = "TKT-0001") {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** Set up successful GET responses for ticket and assignable-users. */
function setupGetSuccess(ticket: ApiTicket = BASE_TICKET) {
  mockedAxios.get = vi.fn().mockImplementation((url: string) => {
    if (url.includes("assignable-users")) {
      return Promise.resolve({ data: USERS });
    }
    return Promise.resolve({ data: ticket });
  });
}

// ---------------------------------------------------------------------------
// Suite 1 — assignableUserSchema
// ---------------------------------------------------------------------------

describe("assignableUserSchema", () => {
  it("accepts a valid { id, name } object", () => {
    const result = assignableUserSchema.safeParse({ id: "abc", name: "Alice" });
    expect(result.success).toBe(true);
  });

  it("rejects an object missing id", () => {
    const result = assignableUserSchema.safeParse({ name: "Alice" });
    expect(result.success).toBe(false);
  });

  it("rejects an object missing name", () => {
    const result = assignableUserSchema.safeParse({ id: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty object", () => {
    const result = assignableUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — assignTicketSchema
// ---------------------------------------------------------------------------

describe("assignTicketSchema", () => {
  it("accepts a valid UUID", () => {
    const result = assignTicketSchema.safeParse({
      assignedToId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null (unassign)", () => {
    const result = assignTicketSchema.safeParse({ assignedToId: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.assignedToId).toBeNull();
  });

  it("rejects a non-UUID string", () => {
    const result = assignTicketSchema.safeParse({ assignedToId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = assignTicketSchema.safeParse({ assignedToId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects when assignedToId is missing from the body", () => {
    const result = assignTicketSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects undefined assignedToId", () => {
    const result = assignTicketSchema.safeParse({ assignedToId: undefined });
    expect(result.success).toBe(false);
  });

  it("field error message mentions 'valid UUID' for invalid strings", () => {
    const result = assignTicketSchema.safeParse({ assignedToId: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.flatten().fieldErrors.assignedToId?.join("");
      expect(msg).toMatch(/valid uuid/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — TicketDetail: loading and error states
// ---------------------------------------------------------------------------

describe("TicketDetail — loading and error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Back to Tickets link immediately (before data loads)", () => {
    mockedAxios.get = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    renderDetail();
    expect(screen.getByRole("link", { name: /back to tickets/i })).toBeInTheDocument();
  });

  it("shows an error message when the ticket fetch fails (e.g. 404)", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 404 } });
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText(/failed to load ticket/i)).toBeInTheDocument()
    );
  });

  it("shows an error message for a non-existent ticketId", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 404 } });
    renderDetail("TKT-9999");
    await waitFor(() =>
      expect(screen.getByText(/failed to load ticket/i)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — TicketDetail: ticket data rendering
// ---------------------------------------------------------------------------

describe("TicketDetail — ticket data rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetSuccess();
  });

  it("shows the ticketId", async () => {
    renderDetail();
    expect(await screen.findByText("TKT-0001")).toBeInTheDocument();
  });

  it("shows the ticket title as a heading", async () => {
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Network Issue Troubleshooting" })
    ).toBeInTheDocument();
  });

  it("shows the category badge", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    // "Support" appears in both the header badge and the category trigger — use getAllByText
    expect(screen.getAllByText("Support").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the priority badge", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows the status badge", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    // "Open" appears in both the header badge and the status trigger — use getAllByText
    expect(screen.getAllByText("Open").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the project metadata label and value", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Email Intake")).toBeInTheDocument();
  });

  it("shows the Created by metadata label and value", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Created by")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows the Description section with the ticket body", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(
      screen.getByText(/Users on floor 3 cannot reach the internal wiki/i)
    ).toBeInTheDocument();
  });

  it("shows the Back to Tickets link", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByRole("link", { name: /back to tickets/i })).toBeInTheDocument();
  });

  it("Back to Tickets link points to /tickets", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByRole("link", { name: /back to tickets/i })).toHaveAttribute(
      "href",
      "/tickets"
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — TicketDetail: assignee display
// ---------------------------------------------------------------------------

describe("TicketDetail — assignee display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Unassigned' in the trigger when ticket.assignedTo is null", async () => {
    setupGetSuccess(BASE_TICKET); // assignedTo: null
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
  });

  it("shows the assignee name in the trigger when ticket is assigned", async () => {
    setupGetSuccess(ASSIGNED_TICKET); // assignedTo: Alice Agent
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Alice Agent")).toBeInTheDocument();
  });

  it("shows the Assigned to metadata label", async () => {
    setupGetSuccess(BASE_TICKET);
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Assigned to")).toBeInTheDocument();
  });

  it("fetches assignable users on mount", async () => {
    setupGetSuccess(BASE_TICKET);
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/tickets/assignable-users"),
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — TicketDetail: assign mutation
// ---------------------------------------------------------------------------

describe("TicketDetail — assign mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls PATCH with the user's id when a user is selected", async () => {
    setupGetSuccess(BASE_TICKET);
    mockedAxios.patch = vi.fn().mockResolvedValue({ data: ASSIGNED_TICKET });

    renderDetail();
    await screen.findByText("TKT-0001");

    // Find the Assignee trigger specifically — it shows "Unassigned" for BASE_TICKET
    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const assigneeTrigger = Array.from(triggers).find((t) => t.textContent?.includes("Unassigned")) as HTMLElement;
    await userEvent.click(assigneeTrigger);

    // Click the first real user option (index 1, after "Unassigned")
    const items = document.querySelectorAll('[data-slot="select-item"]');
    await userEvent.click(items[1]); // Alice Agent

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/TKT-0001/assignee"),
        { assignedToId: "00000000-0000-0000-0000-000000000001" },
        expect.any(Object)
      );
    });
  });

  it("calls PATCH with null when Unassigned option is selected", async () => {
    setupGetSuccess(ASSIGNED_TICKET); // starts assigned — trigger shows "Alice Agent"
    mockedAxios.patch = vi.fn().mockResolvedValue({ data: BASE_TICKET });

    renderDetail();
    await screen.findByText("TKT-0001");

    // Find the Assignee trigger by its current value (Alice Agent)
    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const assigneeTrigger = Array.from(triggers).find((t) => t.textContent?.includes("Alice Agent")) as HTMLElement;
    await userEvent.click(assigneeTrigger);

    // Click the first option — "Unassigned"
    const items = document.querySelectorAll('[data-slot="select-item"]');
    await userEvent.click(items[0]); // Unassigned

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/TKT-0001/assignee"),
        { assignedToId: null },
        expect.any(Object)
      );
    });
  });

  it("shows an error message when PATCH fails", async () => {
    setupGetSuccess(BASE_TICKET);
    mockedAxios.patch = vi.fn().mockRejectedValue(new Error("Server error"));

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const assigneeTrigger = Array.from(triggers).find((t) => t.textContent?.includes("Unassigned")) as HTMLElement;
    await userEvent.click(assigneeTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    await userEvent.click(items[1]);

    await waitFor(() => {
      expect(screen.getByText(/failed to update assignee/i)).toBeInTheDocument();
    });
  });

  it("invalidates the ticket query after a successful PATCH", async () => {
    setupGetSuccess(BASE_TICKET);
    mockedAxios.patch = vi.fn().mockResolvedValue({ data: ASSIGNED_TICKET });

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const assigneeTrigger = Array.from(triggers).find((t) => t.textContent?.includes("Unassigned")) as HTMLElement;
    await userEvent.click(assigneeTrigger);
    const items = document.querySelectorAll('[data-slot="select-item"]');
    await userEvent.click(items[1]);

    // After successful PATCH, the component re-fetches the ticket (invalidateQueries)
    await waitFor(() => {
      const getCalls = (mockedAxios.get as ReturnType<typeof vi.fn>).mock.calls;
      const ticketRefetches = getCalls.filter(
        ([url]: [string]) => url.includes("/api/tickets/TKT-0001") && !url.includes("assignable-users")
      );
      expect(ticketRefetches.length).toBeGreaterThanOrEqual(2); // initial + refetch
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — updateStatusSchema
// ---------------------------------------------------------------------------

describe("updateStatusSchema", () => {
  it("accepts every valid status value", () => {
    for (const status of STATUSES) {
      expect(updateStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects an invalid status string", () => {
    expect(updateStatusSchema.safeParse({ status: "INVALID" }).success).toBe(false);
  });

  it("rejects when status field is missing", () => {
    expect(updateStatusSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(updateStatusSchema.safeParse({ status: "" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — updateTypeSchema
// ---------------------------------------------------------------------------

describe("updateTypeSchema", () => {
  it("accepts every valid type value", () => {
    for (const type of TICKET_TYPES) {
      expect(updateTypeSchema.safeParse({ type }).success).toBe(true);
    }
  });

  it("rejects an invalid type string", () => {
    expect(updateTypeSchema.safeParse({ type: "INVALID" }).success).toBe(false);
  });

  it("rejects when type field is missing", () => {
    expect(updateTypeSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(updateTypeSchema.safeParse({ type: "" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 9 — TicketDetail: status dropdown
// ---------------------------------------------------------------------------

describe("TicketDetail — status dropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetSuccess(BASE_TICKET); // STATUS.OPEN
  });

  it("Status trigger shows the current status label", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    // "Open" appears in the status trigger (BASE_TICKET is STATUS.OPEN)
    const statusRow = screen.getByText("Status").closest("div")!;
    expect(statusRow).toHaveTextContent("Open");
  });

  it("calls PATCH /status with new value when selection changes", async () => {
    mockedAxios.patch = vi.fn().mockResolvedValue({
      data: { ...BASE_TICKET, status: "IN_PROGRESS" },
    });

    renderDetail();
    await screen.findByText("TKT-0001");

    // Open the Status dropdown — it's the second trigger (assignee is last)
    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    // Status trigger is the one containing "Open"
    const statusTrigger = Array.from(triggers).find((t) => t.textContent?.includes("Open")) as HTMLElement;
    await userEvent.click(statusTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    const inProgressItem = Array.from(items).find((i) => i.textContent?.includes("In Progress")) as HTMLElement;
    await userEvent.click(inProgressItem);

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/TKT-0001/status"),
        { status: "IN_PROGRESS" },
        expect.any(Object)
      );
    });
  });

  it("shows error message when PATCH /status fails", async () => {
    mockedAxios.patch = vi.fn().mockRejectedValue(new Error("Server error"));

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const statusTrigger = Array.from(triggers).find((t) => t.textContent?.includes("Open")) as HTMLElement;
    await userEvent.click(statusTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    const resolvedItem = Array.from(items).find((i) => i.textContent?.includes("Resolved")) as HTMLElement;
    await userEvent.click(resolvedItem);

    await waitFor(() => {
      expect(screen.getByText(/failed to update status/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 10 — TicketDetail: type/category dropdown
// ---------------------------------------------------------------------------

describe("TicketDetail — type dropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetSuccess(BASE_TICKET); // TICKET_TYPE.SUPPORT
  });

  it("Category trigger shows the current type label", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    const categoryRow = screen.getByText("Category").closest("div")!;
    expect(categoryRow).toHaveTextContent("Support");
  });

  it("calls PATCH /type with new value when selection changes", async () => {
    mockedAxios.patch = vi.fn().mockResolvedValue({
      data: { ...BASE_TICKET, type: "BUG" },
    });

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const categoryTrigger = Array.from(triggers).find((t) => t.textContent?.includes("Support")) as HTMLElement;
    await userEvent.click(categoryTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    const bugItem = Array.from(items).find((i) => i.textContent?.trim() === "Bug") as HTMLElement;
    await userEvent.click(bugItem);

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/TKT-0001/type"),
        { type: "BUG" },
        expect.any(Object)
      );
    });
  });

  it("shows error message when PATCH /type fails", async () => {
    mockedAxios.patch = vi.fn().mockRejectedValue(new Error("Server error"));

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const categoryTrigger = Array.from(triggers).find((t) => t.textContent?.includes("Support")) as HTMLElement;
    await userEvent.click(categoryTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    const taskItem = Array.from(items).find((i) => i.textContent?.trim() === "Task") as HTMLElement;
    await userEvent.click(taskItem);

    await waitFor(() => {
      expect(screen.getByText(/failed to update category/i)).toBeInTheDocument();
    });
  });
});

