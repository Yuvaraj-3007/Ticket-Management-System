import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  TICKET_TYPE,
  PRIORITY,
  STATUS,
  type ApiTicket,
  type AssignableUser,
} from "@tms/core";
import axios from "axios";
import { TicketDetail } from "../TicketDetail";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  status:      STATUS.OPEN_NOT_STARTED,
  project:     "Email Intake",
  assignedTo:  null,
  createdBy:   { id: "admin-id", name: "Admin" },
  createdAt:   "2026-04-01T10:00:00.000Z",
  updatedAt:   "2026-04-01T10:00:00.000Z",
  attachments: [],
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
      <TicketDetail ticketId={ticketId} />
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
// Suite 1 — Loading state
// ---------------------------------------------------------------------------

describe("TicketDetail — loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a skeleton while the ticket fetch is pending", () => {
    mockedAxios.get = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    renderDetail();
    // Skeletons are rendered via the Skeleton component — look for the wrapper div
    const skeletonContainer = document.querySelector(".space-y-4");
    expect(skeletonContainer).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Error state
// ---------------------------------------------------------------------------

describe("TicketDetail — error state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Failed to load ticket' error message when GET fails", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 500 } });
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText(/failed to load ticket/i)).toBeInTheDocument()
    );
  });

  it("shows the error message for a non-existent ticketId", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 404 } });
    renderDetail("TKT-9999");
    await waitFor(() =>
      expect(screen.getByText(/failed to load ticket/i)).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Ticket data rendering
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

  it("shows the ticket title as an h2 heading", async () => {
    renderDetail();
    expect(
      await screen.findByRole("heading", { name: "Network Issue Troubleshooting" })
    ).toBeInTheDocument();
  });

  it("shows the category badge (Support)", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getAllByText("Support").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the priority badge (High)", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    // "High" appears in both the header badge and the priority EnumSelect trigger
    expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the status badge (Not Started)", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getAllByText("Not Started").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Project label + value (Email Intake)", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Email Intake")).toBeInTheDocument();
  });

  it("shows Created by label + author name (Admin)", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Created by")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows Description heading + ticket body text", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(
      screen.getByText(/Users on floor 3 cannot reach the internal wiki/i)
    ).toBeInTheDocument();
  });

  it("shows Assigned to label", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Assigned to")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 3b — Hours fields rendering
// ---------------------------------------------------------------------------

describe("TicketDetail — hours fields rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders estimated and actual hours as Nh when set", async () => {
    setupGetSuccess({ ...BASE_TICKET, estimatedHours: 8, actualHours: 4 });
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Estimated Hours")).toBeInTheDocument();
    expect(screen.getByText("Actual Hours")).toBeInTheDocument();
    expect(screen.getByTestId("estimated-hours-display")).toHaveTextContent("8h");
    expect(screen.getByTestId("actual-hours-display")).toHaveTextContent("4h");
  });

  it("renders an em-dash when both hours fields are null", async () => {
    setupGetSuccess({ ...BASE_TICKET, estimatedHours: null, actualHours: null });
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByTestId("estimated-hours-display")).toHaveTextContent("—");
    expect(screen.getByTestId("actual-hours-display")).toHaveTextContent("—");
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Assignee display
// ---------------------------------------------------------------------------

describe("TicketDetail — assignee display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Unassigned when assignedTo is null", async () => {
    setupGetSuccess(BASE_TICKET); // assignedTo: null
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
  });

  it("shows the assignee name when assigned", async () => {
    setupGetSuccess(ASSIGNED_TICKET); // assignedTo: Alice Agent
    renderDetail();
    await screen.findByText("TKT-0001");
    expect(screen.getByText("Alice Agent")).toBeInTheDocument();
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
// Suite 5 — Status mutation
// ---------------------------------------------------------------------------

describe("TicketDetail — status mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetSuccess(BASE_TICKET); // STATUS.OPEN_NOT_STARTED
  });

  it("Status trigger shows the current status label", async () => {
    renderDetail();
    await screen.findByText("TKT-0001");
    const statusRow = screen.getByText("Status").closest("div")!;
    expect(statusRow).toHaveTextContent("Not Started");
  });

  it("clicking a status option calls PATCH /status with the new value", async () => {
    mockedAxios.patch = vi.fn().mockResolvedValue({
      data: { ...BASE_TICKET, status: "OPEN_IN_PROGRESS" },
    });

    renderDetail();
    await screen.findByText("TKT-0001");

    // Find the Status trigger — the one containing "Not Started" (from the EnumSelect)
    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const statusTrigger = Array.from(triggers).find((t) =>
      t.textContent?.includes("Not Started")
    ) as HTMLElement;
    await userEvent.click(statusTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    const inProgressItem = Array.from(items).find((i) =>
      i.textContent?.includes("In Progress")
    ) as HTMLElement;
    await userEvent.click(inProgressItem);

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/TKT-0001/status"),
        { status: "OPEN_IN_PROGRESS" },
        expect.any(Object)
      );
    });
  });

  it("shows error message when PATCH /status fails", async () => {
    mockedAxios.patch = vi.fn().mockRejectedValue(new Error("Server error"));

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const statusTrigger = Array.from(triggers).find((t) =>
      t.textContent?.includes("Not Started")
    ) as HTMLElement;
    await userEvent.click(statusTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    const doneItem = Array.from(items).find((i) =>
      i.textContent?.includes("Done")
    ) as HTMLElement;
    await userEvent.click(doneItem);

    await waitFor(() => {
      expect(screen.getByText(/failed to update status/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Category mutation
// ---------------------------------------------------------------------------

describe("TicketDetail — category mutation", () => {
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

  it("clicking a type option calls PATCH /type with the new value", async () => {
    mockedAxios.patch = vi.fn().mockResolvedValue({
      data: { ...BASE_TICKET, type: "BUG" },
    });

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const categoryTrigger = Array.from(triggers).find((t) =>
      t.textContent?.includes("Support")
    ) as HTMLElement;
    await userEvent.click(categoryTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    const bugItem = Array.from(items).find((i) =>
      i.textContent?.trim() === "Bug"
    ) as HTMLElement;
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
    const categoryTrigger = Array.from(triggers).find((t) =>
      t.textContent?.includes("Support")
    ) as HTMLElement;
    await userEvent.click(categoryTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    const taskItem = Array.from(items).find((i) =>
      i.textContent?.trim() === "Task"
    ) as HTMLElement;
    await userEvent.click(taskItem);

    await waitFor(() => {
      expect(screen.getByText(/failed to update category/i)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Assign mutation
// ---------------------------------------------------------------------------

describe("TicketDetail — assign mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selecting a user calls PATCH /assignee with that user's ID", async () => {
    setupGetSuccess(BASE_TICKET); // unassigned
    mockedAxios.patch = vi.fn().mockResolvedValue({ data: ASSIGNED_TICKET });

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const assigneeTrigger = Array.from(triggers).find((t) =>
      t.textContent?.includes("Unassigned")
    ) as HTMLElement;
    await userEvent.click(assigneeTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    await userEvent.click(items[1]); // Alice Agent (index 0 is Unassigned)

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/api/tickets/TKT-0001/assignee"),
        { assignedToId: "00000000-0000-0000-0000-000000000001" },
        expect.any(Object)
      );
    });
  });

  it("selecting Unassigned calls PATCH /assignee with null", async () => {
    setupGetSuccess(ASSIGNED_TICKET); // starts assigned
    mockedAxios.patch = vi.fn().mockResolvedValue({ data: BASE_TICKET });

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const assigneeTrigger = Array.from(triggers).find((t) =>
      t.textContent?.includes("Alice Agent")
    ) as HTMLElement;
    await userEvent.click(assigneeTrigger);

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

  it("shows error when PATCH /assignee fails", async () => {
    setupGetSuccess(BASE_TICKET);
    mockedAxios.patch = vi.fn().mockRejectedValue(new Error("Server error"));

    renderDetail();
    await screen.findByText("TKT-0001");

    const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
    const assigneeTrigger = Array.from(triggers).find((t) =>
      t.textContent?.includes("Unassigned")
    ) as HTMLElement;
    await userEvent.click(assigneeTrigger);

    const items = document.querySelectorAll('[data-slot="select-item"]');
    await userEvent.click(items[1]);

    await waitFor(() => {
      expect(screen.getByText(/failed to update assignee/i)).toBeInTheDocument();
    });
  });
});
